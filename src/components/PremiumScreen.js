import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const BENEFITS=["Match winner predictions","Full odds comparison","Tracked accuracy by market"];
export function PremiumScreen({isVip,onSubscribe,onBack}){
 if(isVip)return h("main",{className:"screen premium-screen"},[
  PageHeader({title:"Premium",onBack}),
  h("section",{className:"premium-success"},[
   h("div",{className:"premium-success-icon"},[h("i",{"data-lucide":"gem"})]),
   text("span",{className:"section-kicker"},"Membership active"),
   text("h1",{},"You're a VIP member."),
   text("p",{},"Every premium signal is currently unlocked on this account.")
  ])
 ]);
 return h("main",{className:"screen premium-screen"},[
  PageHeader({title:"Premium",onBack}),
  h("section",{className:"premium-hero"},[
   text("span",{className:"section-kicker"},"Scoutwave Premium"),
   text("h1",{},"See the full signal."),
   text("p",{},"Unlock deeper match intelligence, market context and tracked performance.")
  ]),
  h("section",{className:"benefit-list card"},BENEFITS.map((item,i)=>h("div",{className:"benefit-row"},[
   h("span",{className:"benefit-number mono"},String(i+1).padStart(2,"0")),
   text("strong",{},item),
   h("i",{"data-lucide":"check"})
  ]))),
  h("section",{className:"plan-grid"},[
   h("button",{className:"plan-card featured-plan",onClick:onSubscribe},[text("span",{className:"eyebrow"},"12 months"),text("strong",{},"$59"),text("small",{},"Best value"),h("span",{className:"plan-cta"},"Choose plan")]),
   h("button",{className:"plan-card",onClick:onSubscribe},[text("span",{className:"eyebrow"},"1 month"),text("strong",{},"$9"),text("small",{},"Flexible"),h("span",{className:"plan-cta"},"Choose plan")])
  ]),
  text("p",{className:"prototype-note"},"This is a prototype checkout; no real payment is processed.")
 ]);
}
