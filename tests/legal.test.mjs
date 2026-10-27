// Run with:  node tests/legal.test.mjs
// The About, Privacy policy and Terms of use pages must each carry real copy (more than 600 words), not a placeholder.
import assert from "node:assert/strict";
import { ABOUT_SECTIONS, PRIVACY_SECTIONS, TERMS_SECTIONS } from "../src/legalContent.js";
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("ok  " + name); };
const words = (sections) => sections.flatMap((s) => [s.h, ...(s.p || []), ...(s.ul || [])]).join(" ").split(/\s+/).filter(Boolean).length;

test("About has more than 600 words", () => assert.ok(words(ABOUT_SECTIONS) > 600, String(words(ABOUT_SECTIONS))));
test("Privacy policy has more than 600 words", () => assert.ok(words(PRIVACY_SECTIONS) > 600, String(words(PRIVACY_SECTIONS))));
test("Terms of use has more than 600 words", () => assert.ok(words(TERMS_SECTIONS) > 600, String(words(TERMS_SECTIONS))));
test("no placeholder wording is left", () => {
  for (const s of [ABOUT_SECTIONS, PRIVACY_SECTIONS, TERMS_SECTIONS]) assert.ok(!/prototype|lorem|TODO/i.test(JSON.stringify(s)));
});
console.log(passed + " passed");
