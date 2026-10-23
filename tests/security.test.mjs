// Run with:  node tests/security.test.mjs
// Injection and cross-site-scripting checks. No network, no browser.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k", NEWS_ACCESS: "t" });
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const root = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const walk = (dir, out = []) => { for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!["node_modules", ".git", "tests"].includes(e.name)) walk(p, out); } else if (p.endsWith(".js")) out.push(p); } return out; };

// ============================================================ database queries (PostgREST filter injection)
const { q } = await import("../api/_query.js");

await test("query helpers: every injection attempt is refused or neutralised", () => {
  for (const bad of ["1&user_id=neq.0", "1;drop table x", "x' or '1'='1", "../../auth/v1/admin/users", "00000000-0000-0000-0000-00000000000g", "a".repeat(40), "", null, undefined, {}, ["x"]])
    assert.throws(() => q.uuid(bad), /Bad id/, String(bad));
  for (const bad of ["1&a=b", "1 or 1=1", "-1", "1e3", 1.5, NaN, Infinity, "0x10", -5, "9".repeat(20), "", null, {}])
    assert.throws(() => q.int(bad), /Bad number/, String(bad));
  assert.equal(q.int(42), "42"); assert.equal(q.int("42"), "42");
  assert.equal(q.ints([1, 2, 3]), "1,2,3");
  assert.throws(() => q.ints([1, "2)&x=y"]), /Bad number/);
  assert.throws(() => q.ints(new Array(501).fill(1)), /Bad list/);
  for (const bad of ["2026-10-20&x=1", "2026-13-45", "yesterday", "2026-10-20T00:00:00Z"]) assert.throws(() => q.day(bad), /Bad date/, bad);
  for (const bad of ["login') or ('1'='1", "a b", "a,b", "a)", "", "x".repeat(70)]) assert.throws(() => q.word(bad), /Bad value/, bad);
  assert.throws(() => q.iso("not a date"), /Bad time/);
  assert.equal(q.word("poisson-v1"), "poisson-v1");
});
await test("query helpers: search terms can't add conditions; text is encoded", () => {
  const dec = (s) => decodeURIComponent(s);
  const like = dec(q.like('x*),or=(id.not.is.null,name.ilike."*'));
  assert.ok(!/[*,()"=]/.test(like.slice(2, -2)), like); // only the wrapping quotes and stars are ours
  assert.equal(q.like("%%%"), ""); assert.equal(q.like("   "), "");
  assert.equal(q.like("Arsenal FC"), encodeURIComponent('"*Arsenal FC*"'));
  assert.ok(!q.text("https://x/y?a=1&b=2,c)").match(/[&,)?=]/)); // fully percent-encoded
});
await test("no file builds a database URL without the helpers", () => {
  const offenders = [];
  for (const file of [...walk("api"), ...walk("server")]) {
    if (file.endsWith("_query.js")) continue;
    const src = read(file);
    // every template literal that names the database or auth REST paths
    for (const m of src.matchAll(/`[^`]*\/(?:rest|auth)\/v1\/[^`]*`/g)) {
      for (const e of m[0].matchAll(/\$\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
        const expr = e[1].trim();
        const ok = /^(q|Q)\.(uuid|uuids|int|ints|day|iso|word|words|text|like)\(/.test(expr) || /^(encodeURIComponent\()/.test(expr) || expr === "path" || /^term$/.test(expr);
        if (!ok) offenders.push(`${file}: \${${expr}}`);
      }
    }
    // string concatenation into a database path
    for (const m of src.matchAll(/["']\/(?:rest|auth)\/v1\/[^"']*["']\s*\+/g)) offenders.push(`${file}: ${m[0]}`);
  }
  assert.deepEqual(offenders, [], "raw values in database URLs:\n" + offenders.join("\n"));
});

await test("the query helper is never shadowed by a local variable of the same name", () => {
  const clashes = [];
  for (const file of [...walk("api"), ...walk("server")]) {
    const src = read(file);
    if (!/import \{ q(?: as \w+)? \} from "\.\/_query\.js"/.test(src) || /import \{ q as Q \}/.test(src)) continue;
    src.split("\n").forEach((line, i) => { if (/\b(const|let|var)\s+q\b|\(\s*q\s*[,)]|\bq\s*=>/.test(line)) clashes.push(`${file}:${i + 1}: ${line.trim()}`); });
  }
  assert.deepEqual(clashes, []);
});

// ============================================================ URLs and links (cross-site scripting)
const { safeUrl } = await import("../src/utils/safeUrl.js");
await test("safeUrl: script-carrying and disguised URLs are refused", () => {
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "  javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)", "\u0000javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "file:///etc/passwd", "//evil.example.com/x", "\\\\evil.example.com", "blob:https://x/y", "ftp://x/y", "javascript&colon;alert(1)", "x".repeat(2100), "", null, undefined, 5, {}])
    assert.equal(safeUrl(bad), "", String(bad));
});
await test("safeUrl: normal links pass, images are stricter", () => {
  for (const ok of ["https://example.com/a?b=1", "http://example.com", "/news/abc", "/news?tag=x", "#top", "mailto:a@b.co", "tel:+4412345"]) assert.equal(safeUrl(ok), ok);
  assert.equal(safeUrl("data:image/png;base64,iVBORw0KGgo=", { image: true }), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(safeUrl("data:image/svg+xml;base64,PHN2Zz4=", { image: true }), ""); // svg can carry script
  assert.equal(safeUrl("data:image/png;base64,iVBOR", { image: false }), "");
  assert.equal(safeUrl("mailto:a@b.co", { image: true }), "");
  assert.equal(safeUrl("http://x.test/a.png", { image: true, httpsOnly: true }), "");
  assert.equal(safeUrl("https://x.test/a.png", { image: true, httpsOnly: true }), "https://x.test/a.png");
});

// A tiny stand-in for the DOM, enough to run h()
class FakeEl {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.listeners = []; this.children = []; this.style = {}; this.dataset = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; } hasAttribute(k) { return k in this.attrs; }
  addEventListener(t, fn) { this.listeners.push(t); } appendChild(c) { this.children.push(c); return c; }
}
globalThis.document = { createElement: (t) => new FakeEl(t), createElementNS: (n, t) => new FakeEl(t), createTextNode: (t) => ({ text: t }) };
const { h } = await import("../src/utils/h.js");

await test("h(): dangerous attributes never reach the page", () => {
  assert.equal(h("a", { href: "javascript:alert(1)" }).attrs.href, undefined);
  assert.equal(h("a", { href: " JAVASCRIPT:alert(1)" }).attrs.href, undefined);
  assert.equal(h("a", { href: "java\nscript:alert(1)" }).attrs.href, undefined);
  assert.equal(h("img", { src: "data:text/html,<script>" }).attrs.src, undefined);
  assert.equal(h("img", { src: "data:image/svg+xml;base64,PHN2Zz4=" }).attrs.src, undefined);
  assert.equal(h("form", { action: "javascript:void(0)" }).attrs.action, undefined);
  assert.equal(h("div", { onclick: "alert(1)" }).attrs.onclick, undefined);
  assert.equal(h("div", { onmouseover: "alert(1)" }).attrs.onmouseover, undefined);
  assert.equal(h("div", { style: "background:url(javascript:alert(1))" }).attrs.style, undefined);
  assert.equal(h("iframe", { srcdoc: "<script>alert(1)</script>" }).attrs.srcdoc, undefined);
  assert.equal(h("div", { innerHTML: "<img onerror=alert(1)>" }).attrs.innerHTML, undefined);
});
await test("h(): normal use is unaffected; new-tab links can't reach back", () => {
  assert.equal(h("a", { href: "/news/x" }).attrs.href, "/news/x");
  assert.equal(h("a", { href: "https://example.com/a" }).attrs.href, "https://example.com/a");
  assert.equal(h("img", { src: "https://media.api-sports.io/x.png" }).attrs.src, "https://media.api-sports.io/x.png");
  const a = h("a", { href: "https://x.test", target: "_blank", rel: "sponsored" });
  assert.deepEqual(a.attrs.rel.split(" ").sort(), ["noopener", "noreferrer", "sponsored"]);
  assert.deepEqual(h("button", { onClick: () => {} }).listeners, ["click"]);
  assert.equal(h("div", { className: "x", "aria-label": "y" }).attrs.class, "x");
  assert.equal(h("div", {}, ["<img src=x onerror=alert(1)>"]).children[0].text, "<img src=x onerror=alert(1)>"); // text stays text
});

// ============================================================ news from outside
const { cleanArticle } = await import("../server/news.js");
await test("news: provider data is cleaned before it reaches the app", () => {
  assert.equal(cleanArticle({ title: "t", url: "javascript:alert(1)" }), null);
  assert.equal(cleanArticle({ title: "t", url: "data:text/html,x" }), null);
  assert.equal(cleanArticle({ title: "t", url: "/relative" }), null);
  const a = cleanArticle({ uuid: "123e4567-e89b-12d3-a456-426614174000", title: "Big \u0000 win\n\nnow", description: "x".repeat(2000), url: "https://news.example/a", image_url: "http://insecure.example/i.jpg", source: "S", published_at: "garbage" });
  assert.equal(a.id, "123e4567-e89b-12d3-a456-426614174000"); assert.equal(a.title, "Big win now"); assert.equal(a.description.length, 600);
  assert.equal(a.image, ""); assert.equal(a.publishedAt, "");
  const b = cleanArticle({ title: "t", url: "https://news.example/b", image_url: "https://i.example/ok.jpg" });
  assert.match(b.id, /^[0-9a-f]{32}$/); assert.equal(b.id, cleanArticle({ title: "other", url: "https://news.example/b" }).id); // stable per link
  assert.equal(b.image, "https://i.example/ok.jpg");
});
await test("news: our own story addresses round-trip and reject junk", async () => {
  const { articlePath, parseArticleId } = await import("../src/newsArticle.js");
  for (const id of ["123e4567-e89b-12d3-a456-426614174000", "0123456789abcdef0123456789abcdef"]) {
    const p = articlePath({ id, title: "Arsenal beat Chelsea 2-1 \u2014 and how!" });
    assert.match(p, /^\/news\/arsenal-beat-chelsea-2-1-and-how-/); assert.equal(parseArticleId(p.split("/")[2]), id);
  }
  for (const junk of ["", "hello", "javascript:alert(1)", "../etc/passwd", "123"]) assert.equal(parseArticleId(junk), "");
});

// ============================================================ the page's own defences
await test("the page policy: no inline scripts or styles, nothing eval-like, framing and plugins off", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const rule = vercel.headers.find((x) => x.source === "/((?!mingt-t).*)"); // every page except the admin area
  const csp = rule.headers.find((h2) => h2.key === "Content-Security-Policy").value;
  const dir = (name) => (csp.split(";").map((s) => s.trim()).find((s) => s.startsWith(name + " ")) || "");
  assert.equal(dir("script-src"), "script-src 'self'");
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp), "no unsafe-* anywhere");
  assert.ok(!/style-src[^;]*unsafe-inline/.test(csp));
  for (const d of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "frame-src 'none'"]) assert.ok(csp.includes(d), d);
  assert.ok(/form-action 'self'/.test(csp) && /upgrade-insecure-requests/.test(csp));
  assert.ok(rule.headers.some((h2) => h2.key === "X-Frame-Options" && h2.value === "DENY"));
  assert.ok(rule.headers.some((h2) => h2.key === "Strict-Transport-Security"));
  const adminRule = vercel.headers.find((x) => x.source.startsWith("/mingt-t") && x.headers.some((h2) => h2.key === "Content-Security-Policy"));
  assert.ok(adminRule, "the admin area keeps its own, stricter policy");
});
await test("index.html: nothing the policy would block", () => {
  const html = read("index.html");
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  for (const [, attrs, body] of scripts) {
    if (/type="application\/ld\+json"/.test(attrs)) continue; // data, never executed
    assert.ok(/\bsrc=/.test(attrs) && body.trim() === "", "inline script found: " + body.slice(0, 60));
  }
  assert.ok(!/\sstyle=/.test(html) && !/\son[a-z]+=/i.test(html) && !/<style\b/i.test(html), "inline style or handler in index.html");
  assert.ok(!/javascript:/i.test(html));
});
await test("source: no way to write HTML or run strings as code", () => {
  const sinks = [];
  for (const file of [...walk("src"), ...walk("mingt-t"), "sw.js"]) {
    const src = read(file);
    src.split("\n").forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, "");
      if (/\.innerHTML\s*=(?!=)/.test(code) && !/\.innerHTML\s*=\s*(""|'')\s*;?/.test(code) && !(file.endsWith("icons.js") && /svg\.innerHTML = ICONS\[name\]/.test(code))) sinks.push(`${file}:${i + 1} innerHTML`);
      if (/\b(eval|new Function)\s*\(/.test(code)) sinks.push(`${file}:${i + 1} eval`);
      if (/document\.write|insertAdjacentHTML|outerHTML\s*=|createContextualFragment|setAttribute\(\s*["']style["']/.test(code)) sinks.push(`${file}:${i + 1} html sink`);
      if (/setTimeout\(\s*["'`]|setInterval\(\s*["'`]/.test(code)) sinks.push(`${file}:${i + 1} string timer`);
    });
  }
  assert.deepEqual(sinks, []);
});
await test("the server-rendered crawler page escapes everything it prints", async () => {
  const { esc } = await import("../api/_site.js");
  assert.equal(esc('<script>alert("x")</script>&\'`'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;&#96;".replace("&#96;", esc("`")));
  const seo = read("api/_seoPages.js");
  assert.ok(seo.includes('replace(/</g, "\\\\u003c")'), "JSON-LD must escape < so it can't close the script block");
});

// ============================================================ placements (ad slots) can't carry script
await test("placements: only safe links and https images; a space needs a headline and a link to go live", async () => {
  const { validateConfig } = await import("../api/_admin.js");
  const make = (p) => ({ placements: { news_top: p } });
  assert.throws(() => validateConfig(make({ on: true, title: "Hi", link: "javascript:alert(1)" })), /link must start/);
  assert.throws(() => validateConfig(make({ on: true, title: "Hi", link: "data:text/html,x" })), /link must start/);
  assert.throws(() => validateConfig(make({ on: true, title: "Hi", link: "mailto:a@b.co" })), /link must start/);
  assert.throws(() => validateConfig(make({ on: true, title: "Hi", link: "https://a.co", image: "http://a.co/x.png" })), /https/);
  assert.throws(() => validateConfig(make({ on: true, title: "", link: "https://a.co" })), /headline and a link/);
  const ok = validateConfig(make({ on: true, title: "<b>Buy</b>", link: "https://a.co/x", image: "https://a.co/i.png", label: "Evil" })).placements.news_top;
  assert.equal(ok.on, true); assert.equal(ok.label, "Sponsored"); assert.equal(ok.title, "<b>Buy</b>"); // text stays text: it is never parsed as HTML
  assert.equal(validateConfig({}).placements.news_list.on, false);
});
globalThis.window = { localStorage: { getItem: () => null, setItem() {} } };
await test("placements: the app drops unusable or unsafe ones", async () => {
  const mod = await import("../src/remoteConfig.js");
  globalThis.localStorage = undefined;
  // sane() isn't exported; go through the saved-copy path
  const saved = { at: Date.now(), data: { placements: { news_top: { on: true, title: "A", link: "javascript:alert(1)" }, news_list: { on: true, title: "B", link: "https://ok.example/x", image: "http://no.example/i.png", label: "Ad" }, news_bottom: { on: false, title: "C", link: "https://c.example" } } } };
  globalThis.window.localStorage.getItem = () => JSON.stringify(saved);
  const fresh = await import("../src/remoteConfig.js?again");
  const p = fresh.getRemote().placements;
  assert.equal(p.news_top, undefined); assert.equal(p.news_bottom, undefined);
  assert.equal(p.news_list.link, "https://ok.example/x"); assert.equal(p.news_list.image, ""); assert.equal(p.news_list.label, "Ad");
});
console.log(`\n${passed} tests passed`);
