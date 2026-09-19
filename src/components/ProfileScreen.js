import { h, text } from "../utils/h.js";
import { SkeletonImage } from "./Skeleton.js";

function row({icon,label,trailing,onClick,showChevron=true}) {
 return h("button",{className:"profile-row",onClick,disabled:!onClick},[
  h("span",{className:"profile-row-icon"},[h("i",{"data-lucide":icon,"aria-hidden":"true"})]),
  text("span",{className:"profile-row-label"},label),
  trailing || (showChevron?h("i",{className:"profile-chevron","data-lucide":"chevron-right","aria-hidden":"true"}):null)
 ]);
}
function toggle(isOn,onToggle){
 return h("button",{className:"settings-toggle "+(isOn?"on":""),"aria-label":"Toggle dark theme","aria-pressed":isOn,onClick:onToggle},[h("span",{className:"settings-toggle-knob"})]);
}
export function ProfileScreen({isVip,coins,favoritesCount,darkTheme,onToggleDarkTheme,onOpenFavorites,onRequestUpgrade,onOpenCoins,currentLanguage,onNavigate,avatarSrc}){
 return h("main",{className:"screen profile-screen"},[
  h("header",{className:"profile-hero"},[
   avatarSrc?SkeletonImage({src:avatarSrc,size:56,radius:"50%"}):h("div",{className:"profile-avatar"},"S"),
   h("div",{className:"profile-identity"},[
    text("strong",{},"Scout"),
    text("span",{className:"profile-plan "+(isVip?"vip":"")},isVip?"VIP member":"Free plan")
   ]),
   h("button",{className:"icon-button profile-edit",onClick:()=>onNavigate("edit-profile"),"aria-label":"Edit profile"},[h("i",{"data-lucide":"pencil"})])
  ]),
  h("section",{className:"premium-panel"},[
   h("button",{className:"premium-row",onClick:onRequestUpgrade},[
    h("span",{className:"premium-icon"},[h("i",{"data-lucide":"gem"})]),
    h("span",{className:"premium-copy"},[text("strong",{},isVip?"Manage Premium":"Upgrade to Premium"),text("small",{},isVip?"Your premium access is active":"Unlock advanced match intelligence")]),
    h("i",{className:"profile-chevron","data-lucide":"chevron-right"})
   ]),
   h("button",{className:"premium-row coins-row",onClick:onOpenCoins},[
    h("span",{className:"premium-icon"},[h("i",{"data-lucide":"coins"})]),
    text("strong",{className:"premium-copy single"},"Coins"),
    text("strong",{className:"coin-value mono"},coins),
    h("i",{className:"profile-chevron","data-lucide":"chevron-right"})
   ])
  ]),
  text("div",{className:"profile-section-label"},"ACCOUNT"),
  h("section",{className:"profile-group"},[
   row({icon:"user",label:"Edit profile",onClick:()=>onNavigate("edit-profile")}),
   row({icon:"star",label:"My favourites",trailing:text("span",{className:"profile-trailing"},favoritesCount),onClick:onOpenFavorites}),
   row({icon:"key-round",label:"Change password",onClick:()=>onNavigate("change-password")})
  ]),
  text("div",{className:"profile-section-label"},"PREFERENCES"),
  h("section",{className:"profile-group"},[
   row({icon:"newspaper",label:"News",onClick:()=>onNavigate("news")}),
   row({icon:"bell",label:"Notifications",onClick:()=>onNavigate("notifications")}),
   row({icon:"moon",label:"Dark theme",trailing:toggle(darkTheme,onToggleDarkTheme),showChevron:false})
  ]),
  text("div",{className:"profile-section-label"},"SUPPORT"),
  h("section",{className:"profile-group"},[
   row({icon:"circle-help",label:"Help centre",onClick:()=>onNavigate("help-centre")}),
   row({icon:"triangle-alert",label:"Report issue",onClick:()=>onNavigate("report-issue")}),
   row({icon:"phone",label:"Contact us",onClick:()=>onNavigate("contact-us")}),
   row({icon:"shield",label:"Privacy policy",onClick:()=>onNavigate("privacy-policy")}),
   row({icon:"file-text",label:"Terms of use",onClick:()=>onNavigate("terms-of-use")}),
   row({icon:"info",label:"About",onClick:()=>onNavigate("about")}),
   row({icon:"globe",label:"Language",trailing:text("span",{className:"profile-trailing"},currentLanguage),onClick:()=>onNavigate("language")})
  ]),
  h("button",{className:"profile-login"},[text("span",{},"Log in"),h("i",{"data-lucide":"arrow-right"})])
 ]);
}