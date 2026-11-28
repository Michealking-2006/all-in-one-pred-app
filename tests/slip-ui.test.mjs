// Run with:  node tests/slip-ui.test.mjs   (a tiny fake DOM, no browser, no network)
// The Slip Generator screen and the club search box.
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
const timers=[];window.setTimeout=(f)=>{timers.push(f);return timers.length;};window.clearTimeout=()=>{};
globalThis.fetch=async()=>{throw new Error("offline")};
globalThis.MutationObserver=class{observe(){}};
import assert from "node:assert/strict";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const all = (n, out = []) => { out.push(n); (n.children || []).forEach((c) => all(c, out)); return out; };
const words = (n) => n.text().replace(/\s+/g, " ").trim();


const { ClubSearch } = await import("../src/components/ClubSearch.js");
const { SlipGenerator } = await import("../src/components/SlipGenerator.js");
const { ClubStep } = await import("../src/components/ClubStep.js");

await test("the club search asks for three letters before it searches, and says so", () => {
  const box = ClubSearch({ onPick() {} });
  const input = all(box).find((n) => n.tag === "input");
  input.value = "pa"; input.listeners.input.forEach((f) => f());
  assert.match(words(box), /at least 3 letters/);
  input.value = ""; input.listeners.input.forEach((f) => f());
  assert.doesNotMatch(words(box), /at least 3 letters/);
});
await test("the sign-up club step offers the four quick picks and a search for every other club", () => {
  const step = ClubStep({ primaryLabel: "Continue", onConfirm() {}, onSkip() {} });
  const nodes = all(step);
  assert.equal(nodes.filter((n) => n.attrs.role === "radio").length, 4);
  assert.ok(nodes.some((n) => n.tag === "input" && n.attrs.type === "search"), "a search box");
  assert.ok(nodes.find((n) => n.tag === "button" && /Continue/.test(words(n))).disabled, "Continue waits for a choice");
});
// ---- the full flow with a stubbed network: three matches, predictions for each --------------------------------
await test("a Premium account builds a slip, then keeps, swaps, removes and rebuilds it", async () => {
  const soon = (h) => new Date(Date.now() + h * 3600000).toISOString();
  const probs = { 1: [72, 18, 10], 2: [66, 22, 12], 3: [14, 20, 66], 4: [70, 20, 10] };
  const matches = [1, 2, 3, 4].map((id) => ({
    id, kickoff: soon(2 + id), league: { id: 7, name: "Test League", logo: "" }, home: { id: id * 2, name: "Home " + id, logo: "" }, away: { id: id * 2 + 1, name: "Away " + id, logo: "" },
    prediction: { probs: { home: probs[id][0], draw: probs[id][1], away: probs[id][2] }, over25: 55, btts: 50, xg: { home: 1.7, away: 0.9 }, markets: { home: probs[id][0] / 100, draw: probs[id][1] / 100, away: probs[id][2] / 100, dc1x: 0.9, dcx2: 0.3, dc12: 0.8, over15: 0.8, over25: 0.55, over35: 0.3, btts: 0.5 } },
  }));
  window.setTimeout = (f, ms) => setTimeout(f, ms);
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    if (String(url).startsWith("/api/predicted")) return { ok: true, json: async () => ({ matches, enforced: false, days: 3 }) };
    throw new Error("only our own predictions server should be asked: " + url);
  };
  let upgrades = 0;
  const gen = SlipGenerator({ isVip: true, onRequestUpgrade: () => upgrades++ });
  const press = (re) => all(gen).find((n) => n.tag === "button" && re.test(words(n)) && !n.disabled);
  await new Promise((r) => setTimeout(r, 150));
  all(gen).find((n) => n.tag === "button" && /Generate slip/.test(words(n))).click();
  await new Promise((r) => setTimeout(r, 200));
  let t = words(gen);
  assert.equal(upgrades, 0, "Premium never sees the upgrade page");
  assert.ok(asked.length && asked.every((u) => u.startsWith("/api/predicted")), "matches and predictions come from our own server alone: " + asked.join(" "));
  assert.match(t, /Your slip/, "a slip is shown: " + t.slice(0, 200));
  assert.match(t, /Total odds/); assert.match(t, /Slip win chance/); assert.match(t, /10 staked returns/);
  assert.match(t, /expected goals 1\.7 - 0\.9/);
  const picksOnScreen = () => all(gen).filter((n) => n.className.startsWith("vip-card slip-pick")).length;
  assert.equal(picksOnScreen(), 3);
  press(/Keep/).click();
  assert.match(words(gen), /1 kept/, "a kept pick is counted");
  press(/Swap/).click();
  assert.equal(picksOnScreen(), 3, "a swap keeps the number of picks");
  press(/Remove/).click();
  assert.equal(picksOnScreen(), 2);
  assert.ok(!press(/Remove/), "can't remove below two picks");
  all(gen).find((n) => n.attrs["aria-label"]?.startsWith("Build another slip")).click();
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(picksOnScreen() >= 2, "rebuilt");
  all(gen).find((n) => n.attrs["aria-label"] === "Stake" ).children.find((n) => words(n) === "50").click();
  assert.match(words(gen), /50 staked returns/);
});
await test("the slip generator: options as in the design, and building a slip needs Premium", () => {
  globalThis.fetch = async () => { throw new Error("offline"); };
  let upgrades = 0;
  const gen = SlipGenerator({ isVip: false, onRequestUpgrade: () => upgrades++ });
  const t = words(gen);
  for (const label of ["Number of games", "Risk level", "Safe", "Balanced", "Risky", "Today's matches only", "Select", "Bet types", "Winner", "Minimum odds per match", "Generate slip", "Premium members"].filter((x) => x !== "Select")) assert.ok(t.includes(label), label + " is on the screen: " + t);
  const counts = all(gen).filter((n) => n.attrs["aria-label"]?.endsWith(" games"));
  assert.deepEqual(counts.map((n) => n.attrs["aria-label"]), ["2 games", "3 games", "4 games", "5 games", "6 games", "7 games"]);
  all(gen).find((n) => n.tag === "button" && /Generate slip/.test(words(n))).click();
  assert.equal(upgrades, 1, "Generate opens Premium for a free account");
});

console.log(`\n${passed} passed`);
