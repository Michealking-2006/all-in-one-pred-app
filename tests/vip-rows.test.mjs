// Run with:  node tests/vip-rows.test.mjs   (a tiny fake DOM, no browser)
class N { constructor(t){this.tag=t;this.children=[];this.attrs={};this.style={};this.className="";this.textContent=""; this.classList={add:()=>{},remove:()=>{}};}
  setAttribute(k,v){this.attrs[k]=String(v); if(k==="class")this.className=v;} getAttribute(k){return this.attrs[k]}
  append(...c){this.children.push(...c.flat().filter(Boolean));} appendChild(c){this.children.push(c);return c;} replaceChildren(...c){this.children=c.flat().filter(Boolean);}
  get childNodes(){return []} cloneNode(){return new N(this.tag)} set innerHTML(v){} hasAttribute(k){return k in this.attrs} removeAttribute(k){delete this.attrs[k]} addEventListener(){} removeEventListener(){} set innerHTML(v){} get isConnected(){return true}
  text(){return (this.textContent||"")+this.children.map(c=>typeof c==="string"?c:c.text()).join(" ")} }
globalThis.document={createElement:t=>new N(t),createElementNS:(n,t)=>new N(t),createTextNode:s=>{const n=new N("#t");n.textContent=s;return n},documentElement:{dataset:{}},addEventListener(){},body:new N("body"),querySelector:()=>null,getElementById:()=>null};
const store=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i],get length(){return m.size}}};
globalThis.window={sessionStorage:store(),localStorage:store(),addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),location:{pathname:"/",hash:"",search:"",origin:"https://x"},history:{pushState(){},replaceState(){}},setTimeout,clearTimeout,innerWidth:390};
globalThis.localStorage=window.localStorage;globalThis.sessionStorage=window.sessionStorage;
const { PredictionRow } = await import("../src/components/PredictionCard.js");
import assert from "node:assert/strict";
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("ok  " + name); };
const fx = { fixture: { id: 9, date: "2026-10-31T17:30:00Z" }, league: { name: "Premier League", logo: "https://l/1.png" }, teams: { home: { name: "Arsenal", logo: "https://t/1.png" }, away: { name: "Chelsea", logo: "" } } };
const pred = { confidence: "high", pick: "home", pickProb: 52, probs: { home: 52, draw: 26, away: 22 }, xg: { home: 1.84, away: 1.1 } };
const all = (n, out = []) => { out.push(n); (n.children || []).forEach((c) => all(c, out)); return out; };
const words = (n) => n.text().replace(/\s+/g, " ").trim();

test("an open row reads: league and confidence, teams around the kick-off time, the pick in plain words, the outcome bar", () => {
  const row = PredictionRow(pred, fx);
  assert.match(words(row), /^Premier League High confidence Arsenal .*kick-off Chelsea Model pick Arsenal 52% chance Expected goals 1\.8 to 1\.1 52% Arsenal 26% Draw 22% Chelsea$/);
  assert.ok(!/\u00b7/.test(words(row)), "no middle-dot joined meta text");
  const meter = all(row).filter((n) => n.className === "on");
  assert.equal(meter.length, 3, "high confidence lights all three bars");
});
test("the confidence meter follows the level, and a missing crest becomes a quiet placeholder instead of a broken image", () => {
  const lit = (level) => all(PredictionRow({ ...pred, confidence: level }, fx)).filter((n) => n.tag === "i" && n.className === "on").length;
  assert.deepEqual([lit("high"), lit("medium"), lit("low")], [3, 2, 1]);
  const row = PredictionRow(pred, fx);
  assert.equal(all(row).filter((n) => n.tag === "img" && n.className === "pred-crest").length, 1, "Arsenal has its crest");
  assert.equal(all(row).filter((n) => n.className === "pred-crest pred-crest-blank").length, 1, "Chelsea gets the placeholder");
});
test("a locked row shows no pick, no chances and no outcome bar", () => {
  const text = words(PredictionRow({ ...pred, pick: undefined }, fx, { locked: true }));
  assert.match(text, /Prediction locked/); assert.ok(!/Model pick|chance|Expected goals|%/.test(text));
});
console.log(`\n${passed} tests passed`);
