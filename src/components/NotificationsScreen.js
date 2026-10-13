import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const PREFS = [
  ["kickoff","Match kickoff","Get notified when a followed match starts.","bell"],
  ["goals","Goal alerts","Stay updated when the score changes.","trophy"],
  ["vipTips","New VIP tips","Know when new premium signals are published.","sparkles"],
  ["favourites","Favourite team updates","Updates from clubs you follow.","star"],
  ["priceDrops","Odds price drops","Alerts for tracked market movement.","trending-down"]
];
const LIVE_PREFS = [
  ["goalVibration","Goal vibration","Vibrate when a goal goes in on a match you're watching or have starred.","vibrate"],
  ["whistles","Half-time and full-time whistle","Blow the whistle when the half or the match ends.","volume-2"]
];
const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

function settingsRow([key,title,desc,icon],prefs,onTogglePref){
 return h("div",{className:"settings-row"},[
  h("div",{className:"settings-icon"},[h("i",{"data-lucide":icon})]),
  h("div",{className:"settings-copy"},[text("strong",{},title),text("span",{},desc)]),
  toggleSwitch(!!prefs[key],()=>onTogglePref(key),title)
 ]);
}

function toggleSwitch(on, callback, label) {
 return h("button",{className:"settings-toggle "+(on?"on":""),"aria-label":label,"aria-pressed":on,onClick:callback},[
  h("span",{className:"settings-toggle-knob"})
 ]);
}

export function NotificationsScreen({prefs,onTogglePref,onBack}) {
 return h("main",{className:"screen notifications-screen"},[
  PageHeader({title:"Notifications",onBack}),
  h("section",{className:"settings-intro"},[
   text("span",{className:"section-kicker"},"Alerts"),
   text("h1",{},"Stay in the loop."),
   text("p",{},"Choose the moments that deserve your attention.")
  ]),
  h("section",{className:"settings-list card"},PREFS.map((def)=>settingsRow(def,prefs,onTogglePref))),
  text("div",{className:"profile-section-label"},"Live matches"),
  h("section",{className:"settings-list card"},LIVE_PREFS.map((def)=>settingsRow(def,prefs,onTogglePref))),
  text("p",{className:"screen-note"},"Live alerts work while Scoutwave is open. "+(canVibrate?"":"This device doesn't support vibration, so you'll still see a goal banner. ")+"Whistles need a tap on the app first so your browser allows sound."),
  text("p",{className:"screen-note"},"Push notifications aren't live yet. Your other choices are saved for when they launch.")
 ]);
}