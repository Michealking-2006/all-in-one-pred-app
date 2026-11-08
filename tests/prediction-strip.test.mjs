// Run with:  node tests/prediction-strip.test.mjs   (a tiny fake DOM, no browser, no network)
class N { constructor(t){this.tag=t;this.children=[];this.attrs={};this.style={};this.className="";this.textContent="";this.classList={add:()=>{},remove:()=>{}};}
  setAttribute(k,v){this.attrs[k]=String(v); if(k==="class")this.className=v;} getAttribute(k){return this.attrs[k]}
  append(...c){this.children.push(...c.flat().filter(Boolean));} appendChild(c){this.children.push(c);return c;} replaceChildren(...c){this.children=c.flat().filter(Boolean);}
  get childNodes(){return []} cloneNode(){return new N(this.tag)} set innerHTML(v){} hasAttribute(k){return k in this.attrs} removeAttribute(k){delete this.attrs[k]} addEventListener(){} removeEventListener(){}
  text(){return (this.textContent||"")+this.children.map(c=>typeof c==="string"?c:c.text()).join(" ")} }
globalThis.document={createElement:t=>new N(t),createElementNS:(n,t)=>new N(t),createTextNode:s=>{const n=new N("#t");n.textContent=s;return n},documentElement:{dataset:{}},addEventListener(){},body:new N("body"),querySelector:()=>null,querySelectorAll:()=>[]};
const store=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i],get length(){return m.size}}};
globalThis.window={sessionStorage:store(),localStorage:store(),addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),location:{pathname:"/",hash:"",search:"",origin:"https://x"},history:{pushState(){}},setTimeout:(f,ms)=>setTimeout(f,ms)};
globalThis.localStorage=window.localStorage;globalThis.sessionStorage=window.sessionStorage;
import assert from "node:assert/strict";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const all = (n, out = []) => { out.push(n); (n.children || []).forEach((c) => all(c, out)); return out; };
const words = (n) => n.text().replace(/\s+/g, " ").trim();
const fx = (short = "NS", goals = {}, ft) => ({ fixture: { id: 9, date: "2026-11-05T17:30:00Z", status: { short } }, goals, score: { fulltime: ft || {} }, teams: { home: { name: "Arsenal" }, away: { name: "Chelsea" } } });
const pred = { confidence: "high", pick: "home", pickProb: 52, probs: { home: 52, draw: 26, away: 22 }, likelyScore: { home: 2, away: 1 } };
const { PredictionStrip, predictionSummary, outcomeOf } = await import("../src/components/PredictionStrip.js");

await test("an upcoming match shows the three chances, the pick filled in, and the likely score", () => {
  const s = PredictionStrip(pred, fx());
  assert.equal(words(s), "1 52% X 26% 2 22% Pred 2\u20131");
  const chips = all(s).filter((n) => /ps-chip/.test(n.className));
  assert.deepEqual(chips.map((c) => c.className), ["ps-chip is-pick", "ps-chip", "ps-chip"]);
  assert.equal(s.attrs["aria-hidden"], "true", "the row is one button: its label carries the words");
});
await test("a finished match says whether the pick was right (90-minute result)", () => {
  const hit = PredictionStrip(pred, fx("FT", { home: 2, away: 1 }, { home: 2, away: 1 }));
  assert.ok(all(hit).some((n) => n.className === "ps-chip is-pick hit")); assert.ok(all(hit).some((n) => n.className === "ps-result hit"));
  const miss = PredictionStrip(pred, fx("FT", { home: 0, away: 1 }, { home: 0, away: 1 }));
  assert.ok(all(miss).some((n) => n.className === "ps-chip is-pick miss")); assert.ok(all(miss).some((n) => n.className === "ps-result miss"));
  // went to extra time: the 90-minute score (a draw) counts, not the final goals
  assert.equal(outcomeOf(fx("AET", { home: 2, away: 1 }, { home: 1, away: 1 })), "draw");
  assert.ok(!all(PredictionStrip(pred, fx("1H", { home: 1, away: 0 }))).some((n) => /hit|miss/.test(n.className)), "no verdict while it is being played");
});
await test("a locked pick shows no pick, no numbers and no score: only a lock and how sure the model is", () => {
  const s = PredictionStrip({ locked: true, confidence: "medium", order: 3 }, fx());
  assert.equal(words(s), "Premium pick");
  assert.ok(!/%|\d|Pred/.test(words(s)));
  assert.equal(all(s).filter((n) => n.tag === "i" && n.className === "on").length, 2, "medium lights two bars");
  assert.equal(PredictionStrip({ locked: true, confidence: null }, fx()) !== null, true);
});
await test("nothing to show, nothing drawn; the screen-reader sentence says what the strip says", () => {
  assert.equal(PredictionStrip(null, fx()), null); assert.equal(PredictionStrip({ confidence: "low" }, fx()), null);
  assert.equal(predictionSummary(pred, fx()), "Prediction: Arsenal, 52 percent");
  assert.equal(predictionSummary({ ...pred, pick: "draw" }, fx()), "Prediction: a draw, 26 percent");
  assert.equal(predictionSummary(pred, fx("FT", { home: 2, away: 0 })), "Prediction: Arsenal, 52 percent, correct");
  assert.equal(predictionSummary({ locked: true, confidence: "high" }, fx()), "Premium prediction, high confidence");
});

// ---- the row: asks the server only, never the football data service ----
const asked = [];
globalThis.fetch = async (url) => {
  asked.push(String(url));
  if (String(url).startsWith("/api/predictions")) return new Response(JSON.stringify({ predictions: { 9: pred }, locked: { 10: { confidence: "low", order: 1 } }, enforced: false }), { status: 200 });
  return new Response("{}", { status: 404 });
};
const { MatchRow } = await import("../src/components/MatchRow.js");
const tick = () => new Promise((r) => setTimeout(r, 80));
await test("a match row gets its stored prediction, with one request to our own server and none to the football data service", async () => {
  window.localStorage.setItem("scoutwave.flag.predictions", "on");
  const rowA = MatchRow(fx(), { isFavorite: false, onOpen() {}, onToggleFavorite: () => false });
  const other = { ...fx(), fixture: { id: 10, date: "2026-11-05T19:00:00Z", status: { short: "NS" } } };
  const rowB = MatchRow(other, { isFavorite: false, onOpen() {}, onToggleFavorite: () => false });
  const rowC = MatchRow({ ...fx(), fixture: { id: 11, date: "2026-11-05T19:00:00Z", status: { short: "NS" } } }, { isFavorite: false, onOpen() {}, onToggleFavorite: () => false });
  await tick();
  const mainOf = (row) => row.children[0];
  assert.ok(all(rowA).some((n) => n.className === "pred-strip"), "predicted: strip added");
  assert.match(mainOf(rowA).attrs["aria-label"], /^Arsenal vs Chelsea\. Prediction: Arsenal, 52 percent$/);
  assert.ok(all(rowB).some((n) => n.className === "pred-strip is-locked"), "locked for this person");
  assert.ok(!all(rowC).some((n) => /pred-strip/.test(n.className)), "no stored prediction: the row is untouched");
  assert.equal(mainOf(rowC).attrs["aria-label"], "Arsenal vs Chelsea");
  assert.equal(asked.length, 1, "all three lookups went out as one request: " + asked.join(" | "));
  assert.ok(asked.every((u) => u.startsWith("/api/predictions?fixtures=")), "only our own server was asked");
});
await test("with the predictions flag off, a row asks for nothing", async () => {
  window.localStorage.setItem("scoutwave.flag.predictions", "off"); asked.length = 0;
  const row = MatchRow({ ...fx(), fixture: { id: 77, date: "2026-11-05T19:00:00Z", status: { short: "NS" } } }, { isFavorite: false, onOpen() {}, onToggleFavorite: () => false });
  await tick();
  assert.equal(asked.length, 0); assert.ok(!all(row).some((n) => /pred-strip/.test(n.className)));
});
await test("if our server can't be reached the row simply stays as it was", async () => {
  window.localStorage.setItem("scoutwave.flag.predictions", "on"); asked.length = 0;
  globalThis.fetch = async (url) => { asked.push(String(url)); throw new Error("offline"); };
  const row = MatchRow({ ...fx(), fixture: { id: 88, date: "2026-11-05T19:00:00Z", status: { short: "NS" } } }, { isFavorite: false, onOpen() {}, onToggleFavorite: () => false });
  await tick();
  assert.ok(!all(row).some((n) => /pred-strip/.test(n.className))); assert.ok(asked.every((u) => u.startsWith("/api/predictions")));
});
console.log(`\n${passed} tests passed`);
