// Run with:  node tests/sheet.test.mjs
import assert from "node:assert/strict";
import { dragOffset, backdropOpacity, shouldDismiss, makeVelocityTracker } from "../src/components/sheetDrag.js";
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("ok  " + name); };

test("pulling down follows the finger; pulling up meets resistance", () => {
  assert.equal(dragOffset(0), 0); assert.equal(dragOffset(180), 180);
  assert.ok(dragOffset(-100) < 0 && dragOffset(-100) > -30); // never leaves the screen
  assert.ok(dragOffset(-400) > -50);
});
test("the backdrop fades as the drawer goes down", () => {
  assert.equal(backdropOpacity(0, 600), 1); assert.equal(backdropOpacity(-50, 600), 1);
  assert.equal(backdropOpacity(300, 600), 0.5); assert.equal(backdropOpacity(600, 600), 0); assert.equal(backdropOpacity(900, 600), 0);
  assert.equal(backdropOpacity(10, 0), 1);
});
test("dismiss: far enough, or a quick downward flick; never on an upward flick or a short slow drag", () => {
  assert.equal(shouldDismiss({ dy: 250, height: 600, velocity: 0 }), true);
  assert.equal(shouldDismiss({ dy: 100, height: 600, velocity: 0.1 }), false);
  assert.equal(shouldDismiss({ dy: 60, height: 600, velocity: 0.9 }), true);
  assert.equal(shouldDismiss({ dy: 10, height: 600, velocity: 2 }), false); // a twitch isn't a flick
  assert.equal(shouldDismiss({ dy: 400, height: 600, velocity: -0.5 }), false); // dragged down then flicked back up: keep it
  assert.equal(shouldDismiss({ dy: 150, height: 0, velocity: 0 }), true);
});
test("velocity: measured over the last 100 ms, downward is positive", () => {
  const t = makeVelocityTracker();
  assert.equal(t.velocity(), 0);
  t.add(0, 0); t.add(50, 50); t.add(150, 100);
  assert.ok(Math.abs(t.velocity() - 1.5) < 1e-9); // 150 px in 100 ms
  t.reset(); t.add(100, 0); t.add(40, 60); assert.ok(t.velocity() < 0);
  t.reset(); t.add(0, 0); t.add(30, 500); t.add(31, 600); // old samples fall out of the window
  assert.ok(t.velocity() < 0.05);
});
console.log(`\n${passed} tests passed`);
