// Run with:  node tests/deploy.test.mjs
// Guards the deployment: Vercel's free (Hobby) plan allows at most 12 serverless functions, and every
// non-underscore file in api/ is one. Past that limit the whole deployment fails.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k" });
const root = path.resolve(import.meta.dirname, "..");
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const vercel = JSON.parse(read("vercel.json"));
const LIMIT = 12, HEADROOM = 2;

// everything under api/ that Vercel would turn into a function (underscore-prefixed files and folders are ignored)
const functions = (dir = "api") => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
  if (e.name.startsWith("_") || e.name.startsWith(".")) return [];
  const p = path.join(dir, e.name);
  return e.isDirectory() ? functions(p) : /\.(js|mjs|cjs|ts)$/.test(e.name) ? [p] : [];
});

await test(`at most ${LIMIT - HEADROOM} serverless functions (the plan allows ${LIMIT}); handlers live in server/`, () => {
  const list = functions();
  const stale = list.filter((f) => fs.existsSync(path.join(root, "server", path.basename(f))));
  assert.deepEqual(stale, [], "These files moved to server/ but an old copy is still in api/ (copying a new version over an old one never deletes files). Delete them with: node scripts/clean-stale-functions.mjs\n" + stale.join("\n"));
  assert.ok(list.length <= LIMIT - HEADROOM, `${list.length} functions: ${list.join(", ")}`);
});
await test("every address the app or admin calls resolves to a function or a rewrite", () => {
  const called = new Set();
  const scan = (dir) => { for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) scan(p); else if (p.endsWith(".js")) for (const m of read(p).matchAll(/["'`]\/api\/([a-z][a-z-]*)/g)) called.add(m[1]); } };
  scan("src"); scan("mingt-t"); for (const m of read("sw.js").matchAll(/["'`]\/api\/([a-z][a-z-]*)/g)) called.add(m[1]);
  for (const m of JSON.stringify(vercel.crons).matchAll(/\/api\/([a-z][a-z-]*)/g)) called.add(m[1]);
  const fnFiles = new Set(functions().map((f) => path.basename(f).replace(/\.js$/, "")));
  const rewritten = new Set(vercel.rewrites.map((r) => r.source.replace(/^\/api\//, "")));
  const lost = [...called].filter((n) => !fnFiles.has(n) && !rewritten.has(n));
  assert.deepEqual(lost, [], "addresses with nothing behind them: " + lost.join(", "));
  for (const n of ["config", "me", "spend", "checkout", "predictions", "accuracy", "usage", "news", "feedback", "push", "placement-event", "csp-report"]) assert.ok(rewritten.has(n), n);
  for (const n of ["football", "mingt", "polar-webhook", "cron", "image-proxy"]) assert.ok(fnFiles.has(n), n);
});
await test("every rewrite points at a function that exists and a route it knows", () => {
  const fnFiles = new Set(functions().map((f) => path.basename(f).replace(/\.js$/, "")));
  for (const r of vercel.rewrites) {
    const m = /^\/api\/([a-z-]+)(?:\?(.*))?$/.exec(r.destination);
    if (!m) continue;
    assert.ok(fnFiles.has(m[1]), `${r.source} -> ${r.destination}: no such function`);
    const params = new URLSearchParams(m[2] || "");
    for (const key of ["route", "doc"]) if (params.has(key) && !/^:/.test(params.get(key))) {
      const src = read(`api/${m[1]}.js`);
      assert.ok(new RegExp(`(^|[\\s,{])"?${params.get(key).replace(/-/g, "\\-")}"?\\s*:\\s*\\(\\)\\s*=>\\s*import\\(`, "m").test(src), `${r.source}: ${m[1]} has no ${key} "${params.get(key)}"`);
    }
  }
  for (const f of Object.keys(vercel.functions || {})) assert.ok(fs.existsSync(path.join(root, f)), "per-function settings for a missing file: " + f);
});
await test("every lazily loaded route exists in server/ and exports a handler", async () => {
  for (const entry of ["public", "account", "seo"]) {
    const src = read(`api/${entry}.js`);
    for (const m of src.matchAll(/import\("(\.\.\/server\/[a-z-]+\.js)"\)/g)) {
      assert.ok(fs.existsSync(path.join(root, "api", m[1])), m[1]);
      assert.equal(typeof (await import(path.join(root, "api", m[1]))).default, "function", m[1]);
    }
  }
});
await test("the entry points dispatch to the right handler, hide the routing parameter, and refuse unknown routes", async () => {
  const run = async (file, query, method = "GET", extra = {}) => { const out = { headers: {} }; const res = { setHeader(k, v) { out.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; }, send(b) { out.body = b; return this; }, end() { return this; } }; await (await import(path.join(root, "api", file))).default({ method, query, headers: { host: "x.test" }, ...extra }, res); return out; };
  assert.equal((await run("public.js", { route: "nope" })).code, 404); assert.equal((await run("public.js", {})).code, 404); assert.equal((await run("public.js", { route: "__proto__" })).code, 404); assert.equal((await run("public.js", { route: "constructor" })).code, 404);
  assert.equal((await run("account.js", { route: "nope" })).code, 404); assert.equal((await run("account.js", { route: "toString" })).code, 404);
  const predictions = await run("public.js", { route: "predictions" }); assert.equal(predictions.code, 400); assert.equal(predictions.body.error, "Bad request."); // reached the handler
  assert.equal((await run("public.js", { route: "usage" }, "GET")).code, 405); // usage accepts POST only
  assert.equal((await run("public.js", { route: "csp-report" }, "GET")).code, 405);
  assert.equal((await run("seo.js", { doc: "nope" })).code, 404);
  const robots = await run("seo.js", { doc: "robots" }); assert.equal(robots.code, 200); assert.match(robots.body, /Sitemap: https:\/\/x\.test\/sitemap\.xml/);
  const llms = await run("seo.js", { doc: "llms" }); assert.equal(llms.code, 200); assert.match(llms.body, /^# /);
  assert.notEqual((await run("account.js", { route: "me" })).code, 404); // reached (it answers 401 without a sign-in)
});
await test("every module in api/ and server/ loads (no broken import path after a move)", async () => {
  for (const dir of ["api", "server"]) for (const f of fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith(".js"))) {
    const mod = await import(path.join(root, dir, f));
    if (!f.startsWith("_")) assert.equal(typeof mod.default, "function", `${dir}/${f} has no handler`);
  }
});
await test("the payment webhook stays its own function and keeps its raw-body setting", () => {
  assert.ok(functions().includes(path.join("api", "polar-webhook.js")));
  assert.match(read("api/polar-webhook.js"), /bodyParser:\s*false/);
});
console.log(`\n${passed} tests passed`);
