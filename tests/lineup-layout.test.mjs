// Run with:  node tests/lineup-layout.test.mjs
// No browser: this works out where every player of both teams lands on the pitch, for the common formations and phone
// widths, using the pitch proportions and marker sizes written in theme.css, and fails if two markers would touch or one
// would run into a team label or off the pitch.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { arrangeRows, layoutSide } from "../src/utils/lineup.js";
const root = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(path.join(root, "src/styles/theme.css"), "utf8");
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("ok  " + name); };

const ratio = (re) => { const m = re.exec(css); assert.ok(m, "missing in theme.css: " + re); return Number(m[1]) / 100; };
const tall = { base: ratio(/\.pitch\{position:relative;width:100%;aspect-ratio:100\/(\d+)/), deep: ratio(/\n\.pitch\.deep\{aspect-ratio:100\/(\d+)\}/), narrow: ratio(/@media \(max-width:359px\)\{\s*\.pitch\{aspect-ratio:100\/(\d+)\}/), narrowDeep: ratio(/@media \(max-width:359px\)\{[^}]*\}?\s*\.pitch\.deep\{aspect-ratio:100\/(\d+)\}/) };
const shirtPhoto = Number(/\.pitch-shirt\.photo-ok\{width:(\d+)px/.exec(css)[1]);
const shirtNarrow = Number(/@media \(max-width:359px\)\{[\s\S]*?\.pitch-shirt,\.pitch-shirt\.photo-ok\{width:(\d+)px/.exec(css)[1]);
const NAME = 12, GAP_WITH_RATING = Number(/\.pitch-player:has\(\.rating-pill\)\{gap:(\d+)px/.exec(css)[1]); // the tallest a marker gets: photo, rating pill, name
const LABEL = 26; // the team name pill at the top and bottom edge (3px + 22px + air)

const FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "4-1-4-1", "4-5-1", "5-4-1", "3-4-1-2", "4-3-2-1", "3-4-2-1", "4-1-2-1-2", "4-4-1-1"];
const squad = (n) => Array.from({ length: n }, (_, i) => ({ player: { id: i + 1, name: "P" + i, number: i + 1, pos: i ? "M" : "G" } }));

function boxes(formation, viewport) {
  const narrow = viewport < 360, W = viewport - 32;
  const rows = arrangeRows(squad(11), formation), deep = rows.length >= 6;
  const H = W * (narrow ? (deep ? tall.narrowDeep : tall.narrow) : deep ? tall.deep : tall.base);
  const shirt = narrow ? shirtNarrow : shirtPhoto, h = shirt + GAP_WITH_RATING + NAME;
  const list = [];
  for (const side of ["home", "away"]) for (const s of layoutSide(rows, side)) {
    const w = Math.min(26, Math.max(14, s.span)) / 100 * W;
    list.push({ side, cx: s.x / 100 * W, cy: s.y / 100 * H, w, h });
  }
  return { list, W, H };
}

test("the pitch and marker sizes the test reads are the ones in the stylesheet", () => {
  assert.ok(tall.base > 1.7 && tall.deep > tall.base && tall.narrow > tall.base && tall.narrowDeep > tall.narrow);
  assert.ok(shirtPhoto >= 36 && shirtNarrow <= 34);
});
test("no two players touch, in any common formation, at any phone width from 320 to 430", () => {
  for (const viewport of [320, 360, 390, 430]) for (const f of FORMATIONS) {
    const { list } = boxes(f, viewport);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = Math.abs(a.cx - b.cx) - (a.w + b.w) / 2, dy = Math.abs(a.cy - b.cy) - (a.h + b.h) / 2;
      assert.ok(dx >= -0.5 || dy >= -0.5, `${f} at ${viewport}px: players ${i} and ${j} overlap (${dx.toFixed(1)} x, ${dy.toFixed(1)} y)`);
    }
  }
});
test("every player stays on the pitch and clear of the team name pills at both ends", () => {
  for (const viewport of [320, 360, 390, 430]) for (const f of FORMATIONS) {
    const { list, W, H } = boxes(f, viewport);
    for (const p of list) {
      assert.ok(p.cx - p.w / 2 >= -0.5 && p.cx + p.w / 2 <= W + 0.5, `${f} at ${viewport}px: runs off the side`);
      assert.ok(p.cy - p.h / 2 >= LABEL - 1 && p.cy + p.h / 2 <= H - LABEL + 1, `${f} at ${viewport}px: runs into a team label (${(p.cy - p.h / 2).toFixed(1)} from the edge)`);
    }
  }
});
console.log(`\n${passed} tests passed`);
