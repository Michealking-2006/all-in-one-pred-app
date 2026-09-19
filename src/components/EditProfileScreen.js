import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { SkeletonImage } from "./Skeleton.js";
export function EditProfileScreen({onBack,avatarSrc,onChooseAvatar}){
 return h("main",{className:"screen account-form-screen"},[
  PageHeader({title:"Edit profile",onBack}),
  h("section",{className:"avatar-editor"},[
   h("button",{className:"avatar-editor-button",onClick:onChooseAvatar,"aria-label":"Choose an avatar"},[avatarSrc?SkeletonImage({src:avatarSrc,size:72,radius:"50%"}):text("span",{className:"avatar-editor-fallback"},"S")]),
   h("button",{className:"text-action",onClick:onChooseAvatar},"Change avatar")
  ]),
  h("section",{className:"form-card card"},[
   form("Display name",{value:"Scout"}),
   form("Email",{type:"email",value:"scout@example.com"}),
   h("button",{className:"primary-button",onClick:onBack},"Save changes")
  ])
 ]);
}
function form(label,attrs={}){return h("label",{className:"form-field"},[text("span",{className:"form-field-label"},label),h("input",{...attrs})]);}