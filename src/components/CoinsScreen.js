import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const TIERS=[{coins:10,price:"$0.99"},{coins:50,price:"$3.99"},{coins:120,price:"$7.99",badge:"-10%"},{coins:300,price:"$14.99",badge:"-20%"}];
export function CoinsScreen({coins,onBuy,onBack}){
 return h("main",{className:"screen coins-screen"},[
  PageHeader({title:"Coins",onBack}),
  h("section",{className:"coin-balance"},[
   text("span",{className:"section-kicker"},"YOUR BALANCE"),
   h("div",{className:"coin-balance-value"},[h("span",{className:"coin-big-icon"},[h("i",{"data-lucide":"coins"})]),text("strong",{className:"mono"},coins)]),
   text("p",{},"Use coins to unlock individual premium tips.")
  ]),
  h("div",{className:"section-heading coins-heading"},[h("div",{},[text("span",{className:"section-kicker"},"TOP UP"),text("h2",{},"Choose a pack")])]),
  h("section",{className:"coin-grid"},TIERS.map(t=>h("button",{className:"coin-pack",onClick:()=>onBuy(t.coins)},[
   t.badge?text("span",{className:"coin-badge"},t.badge):null,
   h("span",{className:"coin-pack-icon"},[h("i",{"data-lucide":"coins"})]),
   text("strong",{className:"mono"},t.coins),
   text("small",{className:"mono"},t.price),
   text("span",{className:"coin-pack-action"},"Add coins")
  ]))),
  h("section",{className:"card coin-note"},[h("i",{"data-lucide":"info"}),text("span",{},"Prototype purchases only. No real payment is processed.")])
 ]);
}
