import { h, text } from "../utils/h.js";
import { SkeletonImage } from "./Skeleton.js";
import { displayNameOf } from "./EditProfileScreen.js";

function row({icon,label,trailing,onClick,showChevron=true}) {
 return h(onClick ? "button" : "div",{className:"profile-row",onClick},[
  h("span",{className:"profile-row-icon"},[h("i",{"data-lucide":icon,"aria-hidden":"true"})]),
  text("span",{className:"profile-row-label"},label),
  trailing || (showChevron?h("i",{className:"profile-chevron","data-lucide":"chevron-right","aria-hidden":"true"}):null)
 ]);
}
export function ProfileScreen({isVip,coins,favoritesCount,onOpenFavorites,onRequestUpgrade,onOpenCoins,currentLanguage,onNavigate,avatarSrc,authUser,onOpenAuth,onSignOut}){
 return h("main",{className:"screen profile-screen"},[
  h("header",{className:"profile-hero"},[
   avatarSrc?SkeletonImage({src:avatarSrc,size:56,radius:"50%"}):h("div",{className:"profile-avatar"},"S"),
   h("div",{className:"profile-identity"},[
    text("strong",{},displayNameOf(authUser)),
    text("span",{className:"profile-plan "+(isVip?"vip":"")},isVip?"VIP member":authUser?"Signed in":"Guest")
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
  text("div",{className:"profile-section-label"},"Account"),
  h("section",{className:"profile-group tone-red"},[
   row({icon:"user",label:"Edit profile",onClick:()=>onNavigate("edit-profile")}),
   row({icon:"star",label:"My favourites",trailing:text("span",{className:"profile-trailing"},favoritesCount),onClick:onOpenFavorites}),
   row({icon:"key-round",label:"Change password",onClick:()=>onNavigate("change-password")})
  ]),
  text("div",{className:"profile-section-label"},"Preferences"),
  h("section",{className:"profile-group tone-orange"},[
   row({icon:"newspaper",label:"News",onClick:()=>onNavigate("news")}),
   row({icon:"bell",label:"Notifications",onClick:()=>onNavigate("notifications")})
  ]),
  text("div",{className:"profile-section-label"},"Support"),
  h("section",{className:"profile-group tone-gray"},[
   row({icon:"circle-help",label:"Help centre",onClick:()=>onNavigate("help-centre")}),
   row({icon:"triangle-alert",label:"Report issue",onClick:()=>onNavigate("report-issue")}),
   row({icon:"phone",label:"Contact us",onClick:()=>onNavigate("contact-us")}),
   row({icon:"shield",label:"Privacy policy",onClick:()=>onNavigate("privacy-policy")}),
   row({icon:"file-text",label:"Terms of use",onClick:()=>onNavigate("terms-of-use")}),
   row({icon:"info",label:"About",onClick:()=>onNavigate("about")}),
   row({icon:"globe",label:"Language",trailing:text("span",{className:"profile-trailing"},currentLanguage),onClick:()=>onNavigate("language")})
  ]),
  h("button",{className:"profile-login"+(authUser?" signout":""),onClick:authUser?onSignOut:onOpenAuth},[text("span",{},authUser?"Sign out":"Log in or create account")])
 ]);
}