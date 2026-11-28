// Run with:  node tests/startup-design.test.mjs   (a tiny fake DOM, no browser, no network)
// The redesigned startup: the launch splash and the first-run "which club do you support?" step.
class N { constructor(t){this.tag=t;this.children=[];this.attrs={};this.className="";this.textContent="";this.listeners={};
    this.style={setProperty:()=>{}};this.classList={add:()=>{},remove:()=>{},toggle:()=>{}};this.dataset={};this.value="";this.hidden=false;this.disabled=false;}
  setAttribute(k,v){this.attrs[k]=String(v); if(k==="class")this.className=v;} getAttribute(k){return this.attrs[k]}
  append(...c){this.children.push(...c.flat().filter(Boolean));} appendChild(c){this.children.push(c);return c;}
  replaceChildren(...c){this.children=c.flat().filter(Boolean);} replaceWith(){} hasAttribute(k){return k in this.attrs} removeAttribute(k){delete this.attrs[k]}
  addEventListener(t,f){(this.listeners[t] ||= []).push(f);} removeEventListener(){} focus(){} get isConnected(){return true}
  get childNodes(){return []} cloneNode(){return new N(this.tag)} set innerHTML(v){}
  click(){(this.listeners.click||[]).forEach((f)=>f({preventDefault(){}}));}
  text(){return (this.textContent||"")+this.children.map(c=>typeof c==="string"?c:c.text()).join(" ")} }
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i],get length(){return m.size}}};
globalThis.document={createElement:t=>new N(t),createElementNS:(n,t)=>new N(t),createTextNode:s=>{const n=new N("#t");n.textContent=s;return n},
  documentElement:{dataset:{},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""}},querySelector:()=>null,addEventListener(){},body:new N("body"),hidden:false};
globalThis.window={sessionStorage:memory(),localStorage:memory(),addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),
  location:{pathname:"/",hash:"",search:"",origin:"https://x",href:"https://x/"},history:{pushState(){},replaceState(){}},setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},isSecureContext:true};
globalThis.localStorage=window.localStorage;globalThis.sessionStorage=window.sessionStorage;
globalThis.fetch=async()=>{throw new Error("offline")};
globalThis.MutationObserver=class{observe(){}};

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const all = (n, out = []) => { out.push(n); (n.children || []).forEach((c) => all(c, out)); return out; };
const html = read("index.html"), boot = read("src/styles/boot.css"), css = read("src/styles/theme.css");

await test("the launch screen is a branded splash (mark with waves, wordmark, line, loader) and keeps the page's real text for crawlers and screen readers", () => {
  const main = html.slice(html.indexOf('<main id="boot-fallback"'), html.indexOf("</main>"));
  for (const part of ["boot-mark", "boot-wordmark", "boot-tagline", "boot-bar"]) assert.ok(main.includes(part), part);
  assert.equal((main.match(/class="boot-ring/g) || []).length, 2);
  assert.match(main, /<h1 class="boot-sr">Scoutwave: live football scores, predictions and football data<\/h1>/);
  assert.match(main, /<nav class="boot-nav boot-sr">[\s\S]*href="\/livescores"/);
  assert.match(main, /id="boot-fallback-message" class="boot-sr" role="status"/);
  assert.ok(!/ style=/.test(main), "no inline styles (the Content-Security-Policy forbids them)");
  assert.match(html, /rel="preload" href="\/src\/assets\/scoutwave-mark-white\.png" as="image"/);
});
await test("splash styles: the app's own tokens, club colour from first paint, graceful fallbacks, calm for reduced motion and weak phones", () => {
  assert.match(boot, /\.boot-screen\{[^}]*background:var\(--bg,#f2f2f7\)/);
  assert.match(boot, /color-mix\(in srgb,var\(--accent,#d50000\)/);
  assert.match(boot, /@supports \(\(-webkit-mask-image:url\(x\)\) or \(mask-image:url\(x\)\)\)/, "the wordmark cut-out needs a mask, and is simply absent without one");
  assert.match(boot, /@media \(prefers-reduced-motion:reduce\)\{[^}]*\.boot-ring\{display:none\}/);
  assert.match(boot, /html\[data-lowend\] \.boot-ring\{display:none\}/);
  assert.match(boot, /\.boot-button\{[^}]*var\(--accent,#d50000\)/, "the error screen shares the look");
});

const { ClubStep } = await import("../src/components/ClubStep.js");
await test("club step: choosing updates the cards in place (the grid is never rebuilt, so keyboard focus stays), swaps the hero, enables Continue", () => {
  let confirmed = null, skipped = 0;
  const step = ClubStep({ onConfirm: (c) => { confirmed = c.id; }, onSkip: () => { skipped++; } });
  const grid = all(step).find((n) => /club-step-grid/.test(n.className));
  const cards = () => all(step).filter((n) => /^club-card( selected)?$/.test(n.className));
  const hero = all(step).find((n) => n.className === "club-step-hero");
  const button = all(step).find((n) => n.className === "primary-button");
  assert.equal(cards().length, 4);
  assert.equal(grid.attrs.role, "radiogroup");
  assert.ok(button.disabled, "nothing chosen yet");
  assert.ok(all(hero).some((n) => n.className === "club-step-brand"), "the Scoutwave mark until a club is chosen");
  const before = cards(); before[1].click();
  assert.deepEqual(cards(), before, "same card nodes: nothing was rebuilt");
  assert.deepEqual(cards().map((c) => c.attrs["aria-checked"]), ["false", "true", "false", "false"]);
  assert.equal(cards()[1].className, "club-card selected"); assert.equal(grid.className, "club-step-grid club-card-grid has-choice");
  assert.ok(all(hero).some((n) => n.className === "club-step-plate"), "the crest takes the hero's place");
  assert.ok(!button.disabled);
  before[3].click(); assert.deepEqual(cards().map((c) => c.attrs["aria-checked"]), ["false", "false", "false", "true"]);
  button.click(); assert.equal(confirmed, "man-united");
  all(step).find((n) => n.className === "club-step-skip").click(); assert.equal(skipped, 1);
  assert.ok(/Glory glory/.test(step.text()), "each card shows its club's motto");
});
await test("club cards: kit stripe, tint, dimmed others, staggered entry that never freezes the pressed/selected transforms, buttons that stay on screen", () => {
  assert.match(css, /\.club-card::after\{[^}]*linear-gradient\(90deg,var\(--club-1,var\(--accent\)\) 50%,var\(--club-2,var\(--accent\)\) 50%\)/);
  assert.match(css, /\.club-card-grid\.has-choice \.club-card:not\(\.selected\)\{opacity:\.66\}/);
  assert.match(css, /\.club-step-grid \.club-card\{animation:club-in \.46s var\(--ease\) backwards;/, "backwards, not both: a forwards fill would override transform");
  assert.match(css, /html\[data-lowend\] \.club-step-grid \.club-card\{animation:none\}/);
  assert.match(css, /@supports \(overflow:clip\)\{\.auth-screen\{overflow:clip\}\}/);
  assert.match(css, /\.club-step-actions\{position:sticky;bottom:0;/);
});
console.log(`\n${passed} tests passed`);
