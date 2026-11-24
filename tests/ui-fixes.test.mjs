// Run with:  node tests/ui-fixes.test.mjs
// Guards the fixes from the UI scan (found by loading every route in a phone-sized browser). Static checks: the
// browser run itself is not part of `npm test`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(path.join(root, "src/styles/theme.css"), "utf8");
const h = fs.readFileSync(path.join(root, "src/utils/h.js"), "utf8");
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("ok  " + name); };

test("every image made with h() marks itself when it fails or has no usable address, and the stylesheet hides it", () => {
  assert.match(h, /addEventListener\("error", fail, \{ once: true \}\)/);
  assert.match(h, /if \(!el\.getAttribute\("src"\)\) fail\(\)/);
  assert.match(h, /classList\?\.add\("img-failed"\)[^;]*;\s*el\.setAttribute\("alt", ""\)/);
  assert.match(css, /img\.img-failed\{visibility:hidden\}/);
  for (const big of ["venue-image", "stadium-image", "article-hero", "placement-image", "news-thumb"]) assert.ok(css.includes(`img.img-failed.${big}`), big);
});
test("match header: a long team name wraps inside its column, and 360px phones get a little room", () => {
  assert.match(css, /\.match-side strong\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /@media \(min-width:360px\) and \(max-width:380px\)\{\.match-side\{font-size:13\.5px\}/);
});
test("sign-in legal line: links no longer stretch the line spacing but keep a tap area", () => {
  const rule = css.match(/\.auth-legal button\{position:relative;padding:0 3px;[^}]*\}/);
  assert.ok(rule, "padding must not be vertical (inline-block buttons grow the line)");
  assert.match(css, /\.auth-legal button::after\{content:"";position:absolute;inset:-8px -3px\}/);
});
console.log(`\n${passed} tests passed`);
