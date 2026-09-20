import { h, text } from "../utils/h.js";

export function PageHeader({ title, onBack, action }) {
 return h("header",{className:"page-header"},[
  h("button",{type:"button",className:"back-button","aria-label":"Back",onClick:onBack},[
   h("i",{"data-lucide":"chevron-left","aria-hidden":"true"}),
   text("span",{},"Back")
  ]),
  text("h1",{className:"page-header-title"},title),
  action || null
 ]);
}

export function formField(label,{tag="input",...attrs}={}){
 return h("label",{className:"form-field"},[
  text("div",{className:"form-field-label"},label),
  h(tag,tag==="textarea"?{rows:"4",...attrs}:{type:"text",...attrs})
 ]);
}