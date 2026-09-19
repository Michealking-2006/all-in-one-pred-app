import { h, text } from "../utils/h.js";
import { matches, trackRecord } from "../data/mockData.js";
export function VipTipsScreen({ isVip, isUnlocked }) {
 return h("main",{className:"screen vip-screen"},[
  h("section",{className:"vip-hero"},[
   text("span",{className:"section-kicker"},"SCOUTWAVE PREMIUM"),
   text("h1",{},"Sharper signals. Less noise."),
   text("p",{},"Premium match intelligence, confidence levels and market signals."),
   h("div",{className:"vip-record"},[text("strong",{className:"mono"},trackRecord.overall+"%"),text("span",{},"30-TIP HIT RATE")])
  ]),
  h("div",{className:"vip-market-grid"},trackRecord.byMarket.map(m=>h("div",{className:"card vip-market"},[text("span",{className:"section-kicker"},m.label),text("strong",{className:"mono"},m.pct+"%")]))),
  h("div",{className:"section-heading vip-heading"},[h("div",{},[text("span",{className:"section-kicker"},"PREMIUM FEED"),text("h2",{},"Today's signals")]),text("span",{className:"muted-count"},matches.length+" picks")]),
  h("div",{className:"vip-list"},matches.map(m=>h("article",{className:"vip-card "+(isUnlocked(m.id)?"unlocked":"locked")},[
   h("div",{className:"vip-card-top"},[text("span",{className:"eyebrow"},m.league),text("span",{className:"badge badge-muted"},m.confidence+"%")]),
   text("strong",{className:"vip-match"},m.home+" vs "+m.away),
   isUnlocked(m.id)?h("div",{className:"vip-pick"},[text("span",{className:"eyebrow"},"SIGNAL"),text("strong",{},m.winner),text("span",{className:"confidence"},m.confidence+"% confidence")]):h("div",{className:"vip-lock"},[h("i",{"data-lucide":"lock"}),text("span",{},"Premium signal locked")])
  ])))
 ]);
}