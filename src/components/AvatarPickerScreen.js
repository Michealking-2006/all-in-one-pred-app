import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { SkeletonImage } from "./Skeleton.js";
import { avatars } from "../data/avatars.js";
export function AvatarPickerScreen({current,onSelect,onBack}){
 return h("main",{className:"screen avatar-screen"},[
  PageHeader({title:"Choose an avatar",onBack}),
  h("section",{className:"avatar-picker card"},avatars.map(a=>{
   const selected=a.id===current;
   return h("button",{className:"avatar-option "+(selected?"selected":""),"aria-label":"Select "+a.label,"aria-pressed":selected,onClick:()=>onSelect(a.id)},[
    h("span",{className:"avatar-image"},[SkeletonImage({src:a.src,alt:a.label,size:64,radius:"50%"})]),
    text("span",{className:"avatar-label"},a.label),
    selected?h("span",{className:"avatar-check"},[h("i",{"data-lucide":"check"})]):null
   ]);
  }))
 ]);
}