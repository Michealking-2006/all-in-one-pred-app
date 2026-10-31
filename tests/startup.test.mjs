// Run with:  node tests/startup.test.mjs
// Startup weight and first-paint behaviour: what loads before the first screen, and what waits.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const root = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

// ---- the startup import graph (what the first screen needs, before anything is loaded on demand)
const graph = (entry) => {
  const seen = new Map(), stack = [path.join(root, entry)];
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p) || !fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, "utf8"); seen.set(p, src.length);
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;\n]*?from\s+"(\.[^"]+)"/g)) stack.push(path.normalize(path.join(path.dirname(p), m[1])));
  }
  return seen;
};
const startup = graph("src/App.js");
const inStartup = (rel) => startup.has(path.join(root, "src", rel));

await test("startup budget: the code loaded before the first screen stays small", () => {
  const kb = [...startup.values()].reduce((t, n) => t + n, 0) / 1024;
  assert.ok(kb <= 180, `startup code is ${kb.toFixed(0)} KB (budget 180); something heavy was imported at the top of a startup module`);
  assert.ok(startup.size <= 40, `${startup.size} startup modules (budget 40)`);
});
await test("things that aren't needed for the first screen are not in the startup code", () => {
  for (const rel of ["themeFx.js", "pullToRefresh.js", "push.js", "usageBeacon.js", "predictions/model.js", "predictions/tracker.js", "predictions/engine.js", "seoAudit.js", "seoEntities.js", "clubStats.js", "share/cards.js", "components/ClubPage.js", "components/ArticlePage.js"])
    assert.ok(!inStartup(rel), `${rel} loads at startup`);
  for (const rel of ["themeFxData.js", "store.js", "router.js", "components/HomeScreen.js"]) assert.ok(inStartup(rel), `${rel} should be part of startup`);
});
await test("one font everywhere: the iPhone's own font on Apple devices, self-hosted Inter elsewhere, nothing from another site", () => {
  const html = read("index.html");
  const sheets = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0]);
  assert.ok(sheets.length >= 1 && sheets.every((l) => /href="\/src\/styles\//.test(l)), "only the app's own stylesheets: " + sheets.join("\n"));
  assert.ok(!/fonts\.googleapis|fonts\.js/.test(html), "the page loads no web font");
  const css = read("src/styles/theme.css");
  const stack = css.match(/--font-display:([^;]+);/)[1];
  assert.match(stack, /^-apple-system,BlinkMacSystemFont,'Inter',/); assert.ok(!/DM Sans|Space Mono/.test(stack), "no other web font in the stack: " + stack);
  const boot = read("src/styles/boot.css");
  assert.match(boot, /@font-face\{font-family:'Inter'[^}]*url\('\/src\/assets\/fonts\/inter-latin-var\.woff2'\)/, "Inter is declared once, from our own server");
  assert.ok(!/Space Mono/.test(css));
  const families = [...css.matchAll(/font-family:([^;}]+)/g)].map((m) => m[1].trim()).filter((f) => f !== "var(--font-display)");
  assert.deepEqual(families, [], "every font-family comes from the one variable: " + families.join(" | "));
  assert.match(css, /button,input,select,textarea\{font:inherit/); // form controls follow it too
});

// ---- icons: parse once, copy afterwards
class Node { constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.style = {}; this.parsed = 0; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; } hasAttribute(k) { return k in this.attrs; }
  addEventListener() {} appendChild(c) { this.children.push(c); return c; } get childNodes() { return this.children; }
  cloneNode() { const n = new Node(this.tag); n.attrs = { ...this.attrs }; n.children = this.children.map((c) => c.cloneNode()); return n; }
  set innerHTML(v) { Node.parses++; this.children = [...String(v).matchAll(/<([a-z]+)\b[^>]*>/g)].map((m) => { const c = new Node(m[1]); c.attrs.d = m[0]; return c; }); } }
Node.parses = 0;
globalThis.document = { createElement: (t) => new Node(t), createElementNS: (ns, t) => new Node(t), createTextNode: (t) => ({ text: t }), documentElement: { dataset: {} } };
await test("icons: each icon's markup is parsed once, however many times it is drawn", async () => {
  const { Icon } = await import("../src/utils/icons.js");
  const before = Node.parses;
  const stars = Array.from({ length: 500 }, () => Icon("star", { size: 16 }));
  assert.equal(Node.parses - before, 1, "500 stars must cost one parse");
  assert.ok(stars[0].children.length >= 1); assert.notEqual(stars[0].children[0], stars[1].children[0], "each icon gets its own elements");
  assert.equal(stars[499].children.length, stars[0].children.length); assert.equal(stars[3].attrs.width, "16");
  Icon("bell"); Icon("bell"); assert.equal(Node.parses - before, 2);
  assert.doesNotThrow(() => Icon("definitely-not-an-icon")); // a missing name draws an empty icon, as before
});

// ---- the animated theme: data at startup, effects on demand
globalThis.window = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {}, matchMedia: () => ({ matches: false }) };
await test("themes: the app starts with the theme data only, and a default user never loads the animation", async () => {
  const data = await import("../src/themeFxData.js");
  assert.deepEqual(Object.keys(data).sort(), ["FX_THEMES", "activeFxTheme", "applyFxAttribute", "attachNavFx", "currentFxTheme", "fxEntitled", "fxPriceOf", "fxThemeById", "initThemeFx"].sort());
  assert.ok(data.FX_THEMES.length >= 4);
  const nav = { isConnected: true };
  assert.equal(data.attachNavFx(nav, {}, () => null, {}), undefined); // no theme on: returns at once, loads nothing
  data.initThemeFx(); assert.equal(globalThis.document.documentElement.dataset.fx, undefined);
});
await test("themes: the animation module still exposes everything the themes screen uses", async () => {
  const fx = await import("../src/themeFx.js");
  for (const name of ["FX_THEMES", "fxEntitled", "fxPriceOf", "attachFx", "ensureFxLayers", "currentFxTheme"]) assert.equal(typeof fx[name] === "function" || Array.isArray(fx[name]), true, name);
  assert.equal(fx.FX_THEMES, (await import("../src/themeFxData.js")).FX_THEMES, "one list of themes, not two");
});
await test("cache lifetimes: app files and images are reused between launches; pages, API, service worker and admin stay fresh", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const ruleFor = (p) => vercel.headers.filter((h) => h.headers.some((x) => x.key === "Cache-Control") && new RegExp("^" + h.source.replace(/\(\.\*\)/g, ".*").replace(/\\\./g, "\\.") + "$").test(p)).map((h) => h.headers.find((x) => x.key === "Cache-Control").value);
  assert.match(ruleFor("/src/App.js")[0], /max-age=300/); assert.match(ruleFor("/src/styles/theme.css")[0], /max-age=300/);
  assert.match(ruleFor("/src/assets/avatars/messi-avatar.webp")[0], /max-age=604800/); assert.match(ruleFor("/icons/icon-512.png")[0], /max-age=604800/);
  for (const fresh of ["/", "/index.html", "/api/config", "/manifest.webmanifest"]) assert.deepEqual(ruleFor(fresh), [], fresh + " must not get a long cache");
  assert.match(ruleFor("/sw.js")[0], /no-cache|max-age=0|no-store/); assert.match(ruleFor("/mingt-t/admin.js")[0], /no-store|no-cache|max-age=0/);
});
console.log(`\n${passed} tests passed`);
