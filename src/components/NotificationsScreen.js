import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const PREFS = [
  ["kickoff","Match kickoff","Get notified when a followed match starts.","bell"],
  ["goals","Goal alerts","Stay updated when the score changes.","trophy"],
  ["vipTips","New VIP tips","Know when new premium signals are published.","sparkles"],
  ["favourites","Favourite team updates","Updates from clubs you follow.","star"],
  ["priceDrops","Odds price drops","Alerts for tracked market movement.","trending-down"]
];

function toggleSwitch(on, callback, label) {
 return h("button",{className:"settings-toggle "+(on?"on":""),"aria-label":label,"aria-pressed":on,onClick:callback},[
  h("span",{className:"settings-toggle-knob"})
 ]);
}

export function NotificationsScreen({prefs,onTogglePref,onBack}) {
 return h("main",{className:"screen notifications-screen"},[
  PageHeader({title:"Notifications",onBack}),
  h("section",{className:"settings-intro"},[
   text("span",{className:"section-kicker"},"ALERTS"),
   text("h1",{},"Stay in the loop."),
   text("p",{},"Choose the moments that deserve your attention.")
  ]),
  h("section",{className:"settings-list card"},PREFS.map(([key,title,desc,icon])=>
   h("div",{className:"settings-row"},[
    h("div",{className:"settings-icon"},[h("i",{"data-lucide":icon})]),
    h("div",{className:"settings-copy"},[text("strong",{},title),text("span",{},desc)]),
    toggleSwitch(!!prefs[key],()=>onTogglePref(key),title)
   ])
  ))
 ]);
}