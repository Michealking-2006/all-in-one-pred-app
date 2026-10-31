// Run with:  node tests/news-featured.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("ok  " + name); };
const src = fs.readFileSync(path.join(root, "src/components/NewsScreen.js"), "utf8");
const css = fs.readFileSync(path.join(root, "src/styles/theme.css"), "utf8");

test("the featured story stays when the next page loads (only the first page clears its container)", () => {
  const load = src.slice(src.indexOf("function loadPage()"), src.indexOf("markActive();\n  if (resume"));
  assert.match(load, /if \(first\) body\.replaceChildren\(\);/);
  assert.doesNotMatch(load.replace(/if \(first\) body\.replaceChildren\(\);/, ""), /(^|[^.\w])body\.replaceChildren\(\);/m);
  assert.match(load, /body\.appendChild\(featuredCard\(fresh\[0\]/);
});
test("the featured title is never painted with the theme gradient: it sits on red or a photo, where that text vanishes", () => {
  assert.doesNotMatch(css, /html\[data-fx\] :is\([^)]*news-featured-title/);
});
console.log(`\n${passed} tests passed`);
