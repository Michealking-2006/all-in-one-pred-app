import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { pushStatus, enablePush, disablePush } from "../push.js";
import { showToast } from "../toast.js";

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

// "Alerts when the app is closed": one button, with the state read from the browser.
function pushCard() {
  const status = text("span", {}, "Checking this device…");
  const button = h("button", { className: "secondary-button", type: "button" }, ["…"]);
  button.hidden = true;
  let subscribed = false;
  const paint = async () => {
    const s = await pushStatus();
    if (!s.supported) { status.textContent = "This browser can't receive alerts while Scoutwave is closed."; button.hidden = true; return; }
    subscribed = s.subscribed;
    button.hidden = false;
    button.disabled = false;
    button.textContent = subscribed ? "Turn off" : "Turn on";
    status.textContent = subscribed ? "On for this device. Alerts cover matches and clubs you've starred, even when the app is closed."
      : s.permission === "denied" ? "Blocked in your browser settings. Allow notifications for Scoutwave there, then come back."
      : s.needsInstall ? "On iPhone, add Scoutwave to your Home Screen first, then turn alerts on from there."
      : "Get goals, kick-offs, half-time and full-time for matches and clubs you've starred, even when the app is closed.";
  };
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      if (subscribed) await disablePush(); else await enablePush();
    } catch (error) { showToast(error.message || "Couldn't change alerts", "error"); }
    paint();
  });
  paint();
  return h("section", { className: "settings-list card" }, [
    h("div", { className: "settings-row" }, [
      h("div", { className: "settings-icon" }, [h("i", { "data-lucide": "bell" })]),
      h("div", { className: "settings-copy" }, [text("strong", {}, "Alerts on this device"), status]),
      button,
    ]),
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
  pushCard(),
  h("section",{className:"settings-list card"},PREFS.map((def)=>settingsRow(def,prefs,onTogglePref))),
  text("div",{className:"profile-section-label"},"Live matches"),
  h("section",{className:"settings-list card"},LIVE_PREFS.map((def)=>settingsRow(def,prefs,onTogglePref))),
  text("p",{className:"screen-note"},"Vibration and whistles work while Scoutwave is open. "+(canVibrate?"":"This device doesn't support vibration, so you'll still see a goal banner. ")+"Whistles need a tap on the app first so your browser allows sound."),
  text("p",{className:"screen-note"},"Alerts when the app is closed follow the Match kickoff, Goal alerts and Half-time and full-time whistle switches, for matches and clubs you've starred. VIP tips, favourite team news and odds alerts aren't sent yet.")
 ]);
}