// Run with:  node tests/club-ui.test.mjs   (a tiny fake DOM, no browser, no network)
// The club picker, the sign-up step and the "which club do you support?" card.
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
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const all = (n, out = []) => { out.push(n); (n.children || []).forEach((c) => all(c, out)); return out; };
const words = (n) => n.text().replace(/\s+/g, " ").trim();

const { ClubTiles } = await import("../src/components/ClubPicker.js");
const { CLUBS } = await import("../src/clubs.js");

await test("the picker shows the four clubs with their real crests, in both layouts, and reports the tap", () => {
  for (const variant of ["grid", "row"]) {
    let picked = null;
    const tiles = ClubTiles({ selectedId: "chelsea", variant, onSelect: (c) => { picked = c.id; } });
    const buttons = all(tiles).filter((n) => n.tag === "button");
    assert.equal(buttons.length, 4);
    assert.deepEqual(all(tiles).filter((n) => n.tag === "img").map((n) => n.attrs.src), CLUBS.map((c) => c.logo));
    assert.deepEqual(buttons.map((b) => b.attrs["aria-checked"]), ["false", "false", "true", "false"]);
    buttons[3].click();
    assert.equal(picked, "man-united");
  }
  assert.ok(/Manchester United/.test(words(ClubTiles({ variant: "grid", onSelect() {} }))));
});

await test("the club step: Continue stays off until a club is picked, then reports it; Skip reports a skip", async () => {
  const { ClubStep } = await import("../src/components/ClubStep.js");
  let confirmed = null, skipped = 0;
  const step = ClubStep({ primaryLabel: "Create account", onConfirm: (c) => { confirmed = c.id; }, onSkip: () => { skipped++; } });
  const button = all(step).find((n) => n.tag === "button" && n.className === "primary-button");
  assert.equal(button.disabled, true);
  all(step).find((n) => n.className === "club-card").click();
  const again = all(step).find((n) => n.tag === "button" && n.className === "primary-button");
  assert.equal(again.disabled, false);
  again.click();
  assert.equal(confirmed, "barcelona");
  all(step).find((n) => n.className === "club-step-skip").click();
  assert.equal(skipped, 1);
  assert.ok(/Which club do you support\?/.test(words(step)));
});

await test("sign-up has the club as its second step, not as a form field; signing in has none", async () => {
  const { AuthScreen } = await import("../src/components/AuthScreen.js");
  const signup = AuthScreen({ mode: "signup" });
  assert.ok(!/Which club do you support/.test(words(signup)), "the first sign-up screen is only the form");
  assert.equal(all(signup).filter((n) => n.className === "club-card").length, 0);
  const login = AuthScreen({ mode: "login" });
  assert.ok(!/Which club do you support/.test(words(login)));
});

await test("after signing in, a person with no club saved on the account gets the same step full screen", async () => {
  const { ClubWelcome } = await import("../src/components/ClubWelcome.js");
  const screen = ClubWelcome({ onChoose() {}, onSkip() {} });
  assert.ok(/Which club do you support\?/.test(words(screen)) && /Skip for now/.test(words(screen)));
  assert.equal(all(screen).filter((n) => n.className === "club-card").length, 4);
});

await test("the Home card asks people who haven't chosen; it is gone once they have", async () => {
  const { HomeScreen } = await import("../src/components/HomeScreen.js");
  const base = { onOpenMatch() {}, favoriteMatchIds: [], onToggleFavorite() {}, selectedDayOffset: 0, onSelectDay() {}, onOpenProfile() {}, onOpenSearch() {}, onPickClub() {}, onSnoozeClub() {}, onOpenAppearance() {} };
  const without = HomeScreen({ ...base, club: null, showClubPrompt: true });
  assert.ok(/Which club do you support\?/.test(words(without)) && /Not now/.test(words(without)));
  const withClub = HomeScreen({ ...base, club: CLUBS[0], showClubPrompt: false });
  assert.ok(!/Which club do you support/.test(words(withClub)));
  const crest = all(withClub).find((n) => n.className === "header-icon header-crest");
  assert.ok(crest && /Barcelona/.test(crest.attrs["aria-label"]));
});

console.log(`\n${passed} passed`);
