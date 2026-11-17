// Run with:  node tests/theme-apply.test.mjs   (club colours are written once, not on every store change; the boot script switches an owned advanced theme on before first paint)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

const memory = {};
globalThis.localStorage = { getItem: (k) => memory[k] ?? null, setItem: (k, v) => { memory[k] = String(v); }, removeItem: (k) => { delete memory[k]; } };
let writes = 0;
const root = { dataset: { theme: "light" }, style: { setProperty() { writes++; }, removeProperty() {} } };
globalThis.document = { documentElement: root, querySelector: () => null, addEventListener() {}, hidden: false };
globalThis.window = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), localStorage, location: { hash: "" } };
globalThis.MutationObserver = class { observe() {} };
const { applyClubTheme } = await import("../src/clubTheme.js");

await test("club colours: the same club in the same mode is written once, however often the store changes", () => {
  applyClubTheme({ id: "chelsea" });
  const first = writes;
  assert.ok(first > 0 && root.dataset.club === "chelsea");
  for (let i = 0; i < 5; i++) applyClubTheme({ id: "chelsea" });
  assert.equal(writes, first);
});
await test("club colours: dark mode, another club and clearing the club all still take effect", () => {
  const before = writes;
  root.dataset.theme = "dark"; applyClubTheme({ id: "chelsea" });
  assert.ok(writes > before);
  applyClubTheme({ id: "barcelona" }); assert.equal(root.dataset.club, "barcelona");
  applyClubTheme(null); assert.equal(root.dataset.club, undefined);
  applyClubTheme({ id: "barcelona" }); assert.equal(root.dataset.club, "barcelona");
});

// Runs the real boot script against a saved state and returns <html>.
function boot(saved) {
  const html = { dataset: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; } } };
  const env = { localStorage: { getItem: () => JSON.stringify(saved) }, matchMedia: () => ({ matches: false }) };
  new Function("document", "window", "localStorage", "navigator", readFileSync(new URL("../src/boot/theme-init.js", import.meta.url), "utf8"))({ documentElement: html }, env, env.localStorage, { hardwareConcurrency: 8, userAgent: "" });
  return html;
}
await test("boot: an owned advanced theme is on before first paint, and brings its own colours instead of the club's", () => {
  assert.equal(boot({ fxTheme: "fire", unlockedThemes: ["fire"], clubTheme: { id: "chelsea", primary: "#034694" } }).dataset.fx, "fire");
  assert.equal(boot({ fxTheme: "fire", unlockedThemes: ["fire"], clubTheme: { id: "chelsea", primary: "#034694" } }).style.props["--accent"], undefined);
  assert.equal(boot({ fxTheme: "water", isVip: true }).dataset.fx, "water");
});
await test("boot: a theme that isn't owned is never switched on early; the club colour is used as before", () => {
  assert.equal(boot({ fxTheme: "ice", unlockedThemes: ["fire"] }).dataset.fx, undefined);
  assert.equal(boot({ fxTheme: "water", isVip: false }).dataset.fx, undefined);
  assert.equal(boot({ fxTheme: "bubbles" }).dataset.fx, undefined);
  assert.equal(boot({ clubTheme: { id: "chelsea", primary: "#034694" } }).style.props["--accent"], "#034694");
  assert.equal(boot({ fxTheme: "nonsense", unlockedThemes: ["nonsense"] }).dataset.fx, undefined);
});
console.log("\n" + passed + " tests passed");
