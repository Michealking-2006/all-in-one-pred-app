// Run with:  node tests/errors.test.mjs   (no network)
// Nothing shown to a person may name a technology, a setting, a secret, a status code or code.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const { publicText, safeMessage, GENERIC_ERROR } = await import("../src/utils/errors.js");
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

await test("technical messages never reach the screen; plain ones do", () => {
  for (const bad of [
    "Set SCOUTWAVE_FOOTBALL_API_KEY in the Vercel project environment variables.", "The admin area is not set up yet. See docs/ADMIN.md.",
    "TypeError: Cannot read properties of undefined (reading 'map')", "Unexpected token < in JSON at position 0", "Failed to fetch",
    "Football data request failed (HTTP 502).", "Invalid API key", "supabase: JWT expired", "Missing screen export: MatchScreen",
    "relation \"api_cache\" does not exist", "Run supabase/migrations/002_entitlements.sql", "Error 429", "x".repeat(300),
  ]) assert.equal(publicText(bad), GENERIC_ERROR, bad);
  for (const ok of ["Couldn't load this match. Try again.", "Not enough coins.", "Your session has expired. Sign in again.", "The football data limit has been reached for now. Please try again later."]) assert.equal(publicText(ok), ok);
  assert.equal(publicText("", "Custom"), "Custom"); assert.equal(safeMessage(new TypeError("x is undefined"), "Couldn't load."), "Couldn't load.");
  assert.equal(safeMessage(null), GENERIC_ERROR); assert.equal(safeMessage("Plain words."), "Plain words.");
});
await test("no server message names a technology, a setting, a file or a setup step", () => {
  const FORBIDDEN = /vercel|supabase|polar|formspree|openai|api-?football|api-?sports|thenewsapi|readme|docs\/|\.md\b|migration|environment variable|env var|set [A-Z][A-Z0-9_]{4,}|[A-Z]{3,}_[A-Z0-9_]{3,}|not set up|not configured|api key|\btoken\b|service role|totp|two-factor|webhook secret|admin-setup/i;
  const offenders = [];
  for (const file of [...walk("api"), ...walk("server")].filter((f) => f.endsWith(".js"))) {
    const src = read(file);
    // what is sent back to the caller: error: "..." and HttpError(code, "...")
    for (const m of src.matchAll(/(?:\berror:\s*|HttpError\(\s*\d+\s*,\s*)(["`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
      if (FORBIDDEN.test(m[2])) offenders.push(`${file}: ${m[2]}`);
    }
  }
  assert.deepEqual(offenders, []);
});
await test("no screen text points people at setup files, settings or the technology behind the app", () => {
  const FORBIDDEN = /readme|docs\/|\.md\b|environment variable|env var|not set up|isn't set up|not configured|isn't configured|api key|\bvercel\b|\bsupabase\b/i;
  const offenders = [];
  const files = [...walk("src"), ...walk("mingt-t")].filter((f) => f.endsWith(".js") && !/src[\\/](data|legalContent)/.test(f) && !/styles/.test(f));
  for (const file of files) {
    const src = read(file);
    for (const m of src.matchAll(/(?:text:\s*|text\([^)]*?,\s*|showToast\(\s*|new Error\(\s*|error:\s*|message:\s*)(["`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
      if (FORBIDDEN.test(m[2])) offenders.push(`${file}: ${m[2]}`);
    }
  }
  assert.deepEqual(offenders, []);
});
await test("error text goes through the filter wherever a caught error is displayed", () => {
  const raw = [];
  for (const file of walk("src").filter((f) => f.endsWith(".js") && !/src[\\/](data|legalContent)/.test(f) && !f.endsWith("errors.js") && !f.includes("boot"))) {
    const src = read(file).split("\n");
    src.forEach((line, i) => { if (/(?:text\(|errorNode\(|showToast\(|replaceChildren\().*\b(error|err)\??\.message\b/.test(line) && !/safeMessage|publicText/.test(line)) raw.push(`${file}:${i + 1}`); });
  }
  assert.deepEqual(raw, []);
});
await test("the site doesn't hand out its own docs, migrations, server code or setup files", () => {
  const redirects = JSON.parse(read("vercel.json")).redirects || [];
  const covered = (url) => redirects.some((r) => new RegExp("^" + r.source.replace(/:file\(([^)]*)\)/, "($1)").replace(/:path\*/, ".*").replace(/\./g, "\\.").replace(/\\\.\*/g, ".*") + "$").test(url));
  for (const url of ["/README.md", "/CHANGES.md", "/package.json", "/vercel.json", "/docs/ADMIN.md", "/supabase/migrations/002_entitlements.sql", "/server/news.js", "/tests/errors.test.mjs", "/scripts/admin-setup.mjs"]) assert.ok(covered(url), url + " is still downloadable");
  for (const url of ["/", "/index.html", "/sw.js", "/manifest.webmanifest", "/src/App.js", "/icons/icon-192.png", "/mingt-t"]) assert.ok(!covered(url), url + " must stay public");
});
console.log(`\n${passed} tests passed`);
