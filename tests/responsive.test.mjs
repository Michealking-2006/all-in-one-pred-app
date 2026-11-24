// Run with:  node tests/responsive.test.mjs
// The app is a phone column that grows on tablets and desktops. No browser here: this reads index.html and theme.css and
// checks the rules that keep that safe: nothing below 700px changes, every centred fixed element follows --app-w, and
// the desktop side rail never touches an advanced theme (whose tab bar is drawn for a horizontal pill).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(path.join(root, "src/styles/theme.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("ok  " + name); };

const MARK = "Responsive layout";
const at = css.lastIndexOf("/* =====", css.lastIndexOf(MARK));
assert.ok(css.includes(MARK) && at > 0, "the Responsive layout block is missing from theme.css");
const block = css.slice(at);

// Top-level at-rules of the block: [{ query, body }]
function atRules(text) {
  const out = []; let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i); if (open < 0) break;
    const head = text.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, "").trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth) { if (text[j] === "{") depth++; else if (text[j] === "}") depth--; j++; }
    out.push({ head, body: text.slice(open + 1, j - 1) }); i = j;
  }
  return out;
}
const rules = atRules(block);

test("the page scales to the device and still allows the user to zoom", () => {
  const meta = /<meta name="viewport" content="([^"]+)"/.exec(html)?.[1] || "";
  assert.match(meta, /width=device-width/);
  assert.match(meta, /viewport-fit=cover/);
  assert.doesNotMatch(meta, /user-scalable=no|maximum-scale/);
});
test("the app column width is one variable, 480px on phones", () => {
  assert.match(css, /:root\{[^}]*--app-w:480px/);
  assert.match(css, /:root\{[^}]*--rail-w:0px/);
});
test("every centred or fixed element reads --app-w instead of a hard-coded 480px", () => {
  for (const sel of [".app-shell{", ".bottom-nav{", "#pull-refresh-root{", ".nav-compact{"]) {
    const i = css.indexOf(sel); assert.ok(i >= 0, sel + " not found");
    const rule = css.slice(i, css.indexOf("}", i));
    assert.ok(rule.includes("var(--app-w,480px)"), sel + " must use var(--app-w)");
    assert.ok(!/max-width:480px/.test(rule), sel + " still has a hard-coded 480px");
  }
});
test("the breakpoints grow the column in steps: 700, 1024, 1280", () => {
  const width = (q) => Number(new RegExp("--app-w:(\\d+)px").exec(rules.find((r) => r.head.includes(`min-width:${q}px`) && !r.head.includes("max-height"))?.body || "")?.[1]);
  const [a, b, c] = [width(700), width(1024), width(1280)];
  assert.ok(a > 480 && b > a && c > b, `widths ${a}, ${b}, ${c}`);
});
test("nothing in the block applies to phones, except the touch-only hover reset", () => {
  for (const r of rules) {
    assert.ok(/^@media/.test(r.head), "top-level rule outside a media query: " + r.head);
    assert.ok(/min-width:(700|1024|1280|1800)px/.test(r.head) || /hover:none/.test(r.head), "query that reaches phones: " + r.head);
  }
});
test("the side rail only exists without an advanced theme, and takes the tab bar's height out of the layout", () => {
  const desktop = rules.find((r) => r.head.includes("min-width:1024px")).body;
  assert.match(desktop, /html:not\(\[data-fx\]\)\{--rail-w:232px;--tabbar-h:0px\}/);
  for (const line of desktop.split("\n").filter((l) => /\.bottom-nav(-item)?[{ :.]/.test(l) && !/hover/.test(l))) {
    assert.ok(/html:not\(\[data-fx\]\)|data-fx|data-club|data-theme/.test(line), "rail rule not scoped away from advanced themes: " + line.trim());
  }
});
test("toasts, the live card, pull to refresh and the compact header are centred on the content beside the rail", () => {
  const desktop = rules.find((r) => r.head.includes("min-width:1024px")).body;
  assert.match(desktop, /#toast-root\{left:var\(--rail-w\)\}/);
  assert.match(desktop, /#live-card-root\{left:var\(--rail-w\)\}/);
  assert.match(desktop, /#pull-refresh-root[^{]*\.nav-compact\{left:calc\(50% \+ var\(--rail-w\) \/ 2\)\}/);
});
test("the pitch stays phone-sized and the match header keeps the teams together on wide screens", () => {
  const tablet = rules.find((r) => r.head.includes("min-width:700px") && !r.head.includes("max-height")).body;
  assert.match(tablet, /\.pitch\{max-width:460px/);
  assert.match(tablet, /\.match-hero\{padding-left:max\(8px/);
});
test("Games flows into two columns only on wide screens, and notices still span the full width", () => {
  const wide = rules.find((r) => r.head.includes("min-width:1280px")).body;
  assert.match(wide, /\.ios-home-content\{columns:2/);
  assert.match(wide, /\.ios-home-content>\*\{[^}]*column-span:all/);
  assert.match(wide, /\.ios-league-section\{column-span:none/);
});
test("the lineup layout test's assumption (pitch = screen - 32px, phones up to 430px) still holds", () => {
  const m = /\.pitch\{position:relative;width:100%;aspect-ratio:100\/(\d+)/.exec(css);
  assert.ok(m, "base .pitch rule changed");
});
console.log(`\n${passed} tests passed`);
