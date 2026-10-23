// Run with:  node tests/design.test.mjs
// Guards the look of the app: readable colours, no undefined theme variables, no stray global overrides.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(path.join(root, "src/styles/theme.css"), "utf8");
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("ok  " + name); };

// ---- colour maths (WCAG 2.x)
const rgb = (hex) => { let h = hex.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const blend = (fg, a, bg) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
const vars = (selector) => { const m = css.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}")); return m ? Object.fromEntries([...m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()])) : {}; };
const light = vars(":root"), dark = { ...light, ...vars(':root[data-theme="dark"]') };
const WHITE = [255, 255, 255];

test("white text on the result colours is readable (4.5:1) in both modes", () => {
  for (const name of ["--result-win", "--result-draw", "--result-loss"]) for (const [mode, t] of [["light", light], ["dark", dark]])
    assert.ok(ratio(WHITE, rgb(t[name])) >= 4.5, `${name} in ${mode}: ${ratio(WHITE, rgb(t[name])).toFixed(2)}`);
});
test("body, secondary and muted text are readable on their surfaces", () => {
  assert.ok(ratio(rgb(light["--text"]), WHITE) >= 7);
  assert.ok(ratio(rgb(light["--text-dim"]), WHITE) >= 7);
  assert.ok(ratio(rgb(light["--text-muted"]), WHITE) >= 4.5, "muted on white");
  assert.ok(ratio(rgb(light["--text-muted"]), rgb(light["--bg"])) >= 4.5, "muted on page background");
  const surfaceDark = rgb(dark["--surface"]);
  assert.ok(ratio(blend([235, 235, 245], 0.55, surfaceDark), surfaceDark) >= 4.5, "dark muted on surface");
  assert.ok(ratio(rgb(dark["--accent-text"]), surfaceDark) >= 4.5, "dark accent on surface");
  assert.ok(ratio(rgb(light["--accent"]), WHITE) >= 4.5, "light accent on white");
});
test("the position-history line is visible against both surfaces (3:1 for graphics)", () => {
  assert.ok(ratio(rgb(light["--history"]), WHITE) >= 3, "light"); assert.ok(ratio(rgb(dark["--history"]), rgb(dark["--surface"])) >= 3, "dark");
});
test("every theme variable that is used is defined (or set from script on purpose)", () => {
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const fromScript = new Set(["--tabs", "--i", "--d", "--dx", "--travel", "--pointer", "--sx", "--sy", "--n"]);
  const missing = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)(,[^)]*)?\)/g)].filter((m) => !m[2]).map((m) => m[1]))].filter((v) => !defined.has(v) && !fromScript.has(v));
  assert.deepEqual(missing, []);
});
test("the shared form chips are defined once per result, not overridden further down", () => {
  // The club cards scope their colours to .hero-form; a bare ".form-chip.win{background" a second time would recolour every chip in the app.
  const bare = css.split("\n").filter((l) => /^\.form-chip\.(win|draw|loss)\{background:/.test(l.trim()));
  assert.ok(bare.length <= 6, "too many global form-chip colour rules: " + bare.length); // the app's two original sets (3 + 3)
  assert.ok(/\.hero-form \.form-chip\.win\{background:var\(--result-win\)\}/.test(css));
});
test("small round buttons keep a 44-point tap area", () => {
  for (const cls of [".icon-button", ".header-icon"]) assert.ok(new RegExp("\\" + cls + "::after[^}]*inset:-[4-6]px").test(css.replace(/\n/g, "")), cls);
});
test("motion is switched off for people who ask, and fully on the lightest tier", () => {
  assert.ok(/prefers-reduced-motion:\s*reduce/.test(css));
  assert.ok(/html\[data-lowend="2"\] \*[^{]*\{animation:none !important/.test(css));
});
console.log(`\n${passed} tests passed`);
