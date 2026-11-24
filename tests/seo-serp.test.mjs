// Run with:  node tests/seo-serp.test.mjs   (no network)
// What Google needs to show the brand name, a favicon and a tidy description for the home page.
import assert from "node:assert/strict";
import fs from "node:fs";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const { renderPage } = await import("../api/_seoPages.js");
const { DEFAULT_DESCRIPTION } = await import("../src/seoCore.js");
const png = (f) => { const b = fs.readFileSync(f); assert.equal(b.subarray(1, 4).toString(), "PNG"); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const page = await renderPage("/", "https://app.myscoutwave.com");
const ld = [...page.html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
const types = ld.map((d) => d["@type"]).filter(Boolean);

await test("the home page names the site once: one WebSite and one Organization, with alternate names", () => {
  assert.equal(types.filter((t) => t === "WebSite").length, 1); assert.equal(types.filter((t) => t === "Organization").length, 1);
  assert.deepEqual(ld.find((d) => d["@type"] === "WebSite").alternateName, ["Scoutwave Football", "Scoutwave Live Scores"]);
});
await test("the main sections are listed as site navigation with full addresses", () => {
  const nav = ld.find((d) => d["@graph"])["@graph"];
  assert.deepEqual(nav.map((n) => n.name), ["Livescores", "Predictions", "Leagues", "News", "About", "Privacy policy"]);
  assert.ok(nav.every((n) => n["@type"] === "SiteNavigationElement" && n.url.startsWith("https://app.myscoutwave.com/")));
});
await test("favicons are squares in multiples of 48 px, plus /favicon.ico, and the page points at them", () => {
  assert.deepEqual(png("icons/favicon-48.png"), [48, 48]); assert.deepEqual(png("icons/favicon-96.png"), [96, 96]);
  assert.equal(fs.readFileSync("favicon.ico").readUInt16LE(2), 1, "favicon.ico is an icon file");
  for (const h of [page.html, fs.readFileSync("index.html", "utf8")]) for (const f of ["/favicon.ico", "/icons/favicon-48.png", "/icons/favicon-96.png"]) assert.ok(h.includes(f), f);
});
await test("the description fits a result without being cut, and the static page says the same", () => {
  assert.ok(DEFAULT_DESCRIPTION.length <= 155, DEFAULT_DESCRIPTION.length + " characters");
  assert.ok(fs.readFileSync("index.html", "utf8").includes(`content="${DEFAULT_DESCRIPTION}"`));
});
await test("the static page links its main sections as real links", () => {
  const h = fs.readFileSync("index.html", "utf8");
  for (const p of ["/livescores", "/predictions", "/leagues", "/news", "/about", "/privacy-policy"]) assert.ok(h.includes(`<a href="${p}">`), p);
});
console.log(passed + " passed");
