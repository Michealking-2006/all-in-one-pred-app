// Run with:  node tests/imports.test.mjs
// A syntax check can't see a function that is called but never imported (it only fails when someone taps the screen).
// This finds them: any function exported by one app module and called in another file that neither imports nor defines it.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("ok  " + name); };
const walk = (dir, out = []) => { for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (p.endsWith(".js")) out.push(p); } return out; };

const exportsOf = (src) => [...src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);

function check(dirs) {
  const files = dirs.flatMap((d) => walk(d));
  const owner = new Map(); // exported name -> files exporting it
  for (const f of files) for (const n of exportsOf(fs.readFileSync(path.join(root, f), "utf8"))) { if (n.length >= 6) owner.set(n, [...(owner.get(n) || []), f]); }
  const problems = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const [name, from] of owner) {
      if (from.includes(f)) continue;
      if (!new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}\\s*\\(`).test(src)) continue; // not called here
      const defined = new RegExp(`(?:import[^;]*\\b${name}\\b[^;]*from|(?:function|const|let|var|class)\\s+${name}\\b|[(,]\\s*${name}\\s*[,)=]|\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=)`).test(src);
      if (!defined) problems.push(`${f} calls ${name}() but does not import it (exported by ${from[0]})`);
    }
  }
  return problems;
}

test("every function an app file calls from another module is imported", () => assert.deepEqual(check(["src"]), []));
test("every function a server file calls from another module is imported", () => assert.deepEqual(check(["api", "server"]), []));
test("the check itself works: it flags a call to an unimported function", () => {
  const tmp = path.join(root, "src", "__lintprobe.js");
  fs.writeFileSync(tmp, "export function probe() { return getStandings(1, 2); }\n");
  try { assert.ok(check(["src"]).some((p) => p.includes("__lintprobe.js") && p.includes("getStandings"))); } finally { fs.rmSync(tmp); }
});
console.log(`\n${passed} tests passed`);
