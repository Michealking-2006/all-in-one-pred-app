import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { VerifiedBadge } from "../utils/ui.js";

const BENEFITS=["Match winner predictions","Full odds comparison","Tracked accuracy by market","Exclusive Water theme","Verified badge on your profile"];
export function PremiumScreen({isVip,live,onSubscribe,onOpenThemes,onBack}){
 if(isVip)return h("main",{className:"screen premium-screen"},[
  PageHeader({title:"Premium",onBack}),
  h("section",{className:"premium-success"},[
   h("div",{className:"premium-success-icon"},[h("i",{"data-lucide":"gem"})]),
   text("span",{className:"section-kicker"},"Membership active"),
   text("h1",{},"You're a VIP member."),
   text("p",{},"Every prediction is unlocked on this account.")
  ]),
  h("section",{className:"settings-list card premium-perks"},[
   h("div",{className:"settings-row"},[
    h("div",{className:"settings-icon verified-icon"},[h("i",{"data-lucide":"badge-check"})]),
    h("div",{className:"settings-copy"},[h("strong",{className:"premium-perk-title"},[text("span",{},"Verified badge"),VerifiedBadge({size:16})]),text("span",{},"Shown next to your name on your profile.")])
   ]),
   h("button",{type:"button",className:"settings-row premium-perk-link",onClick:onOpenThemes},[
    h("div",{className:"settings-icon water-icon"},[h("i",{"data-lucide":"droplet"})]),
    h("div",{className:"settings-copy"},[text("strong",{},"Water theme"),text("span",{},"Ripples and droplets on your tab bar. Tap to apply it.")]),
    h("i",{className:"profile-chevron","data-lucide":"chevron-right"})
   ])
  ])
 ]);
 return h("main",{className:"screen premium-screen"},[
  PageHeader({title:"Premium",onBack}),
  h("section",{className:"premium-hero"},[
   text("span",{className:"section-kicker"},"Scoutwave Premium"),
   text("h1",{},"Unlock every prediction."),
   text("p",{},"Premium shows every pick in full, compares odds across bookmakers and tracks how the model performs.")
  ]),
  h("section",{className:"benefit-list card"},BENEFITS.map((item,i)=>h("div",{className:"benefit-row"},[
   h("span",{className:"benefit-number mono"},String(i+1).padStart(2,"0")),
   text("strong",{},item),
   h("i",{"data-lucide":"check"})
  ]))),
  h("section",{className:"plan-grid"},[
   h("button",{className:"plan-card featured-plan",onClick:()=>onSubscribe("12m")},[text("span",{className:"eyebrow"},"12 months"),text("strong",{},"$59"),text("small",{},"Best value"),h("span",{className:"plan-cta"},"Choose plan")]),
   h("button",{className:"plan-card",onClick:()=>onSubscribe("1m")},[text("span",{className:"eyebrow"},"1 month"),text("strong",{},"$9"),text("small",{},"Flexible"),h("span",{className:"plan-cta"},"Choose plan")])
  ]),
  text("p",{className:"prototype-note"},live?"Secure checkout by Polar. Premium is added to your account as soon as the payment clears.":"This is a prototype checkout; no real payment is processed.")
 ]);
}
