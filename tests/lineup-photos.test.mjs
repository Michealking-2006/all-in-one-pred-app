// Run with:  node tests/lineup-photos.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("ok  " + name); };
const src = fs.readFileSync(path.join(root, "src/components/LineupPitch.js"), "utf8");
const css = fs.readFileSync(path.join(root, "src/styles/theme.css"), "utf8");

test("lineup photos are never lazy-loaded: they sit hidden until loaded, and a hidden lazy image is never fetched", () => {
  const body = src.slice(src.indexOf("function facePhoto"), src.indexOf("function marker("));
  assert.doesNotMatch(body, /loading:\s*"lazy"/);
  assert.match(css, /\.pitch-photo,\.pitch-num\{display:none\}/); // the reason: hidden until photo-ok
});
test("every phone gets the faces: no photo gate on the pitch, and the substitutes get them too", () => {
  assert.doesNotMatch(src, /showPhotos/);
  assert.match(src, /facePhoto\(photo, "bench-photo"/); assert.match(src, /facePhoto\(src, "pitch-photo"/);
  assert.match(css, /\.bench-avatar\.photo-ok \.bench-photo\{display:block/);
});
test("a face needs a real player id and falls back to the number when it can't load", () => {
  assert.match(src, /Number\.isInteger\(id\) && id > 0/);
  assert.match(src, /naturalWidth > 1\) host\(\)\.classList\.add\("photo-ok"\); else img\.remove\(\)/);
  assert.match(src, /addEventListener\("error", \(\) => img\.remove\(\)\)/);
});
console.log(`\n${passed} tests passed`);
