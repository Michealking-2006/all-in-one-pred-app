import { h, text } from "../utils/h.js";

export function PageHeader({ title, onBack, action, logo = false }) {
 return h("header",{className:"page-header"},[
  h("button",{type:"button",className:"back-button","aria-label":"Back",onClick:onBack},[
   h("i",{"data-lucide":"chevron-left","aria-hidden":"true"}),
   text("span",{},"Back")
  ]),
  logo
   ? h("h1",{className:"page-header-title is-logo","aria-label":"Scoutwave"},[
      h("img",{className:"nav-logo logo-on-light",src:"/src/assets/scoutwave-wordmark.png",alt:"",width:"127",height:"20",decoding:"async"}),
      h("img",{className:"nav-logo logo-on-dark",src:"/src/assets/scoutwave-wordmark-dark.png",alt:"",width:"127",height:"20",decoding:"async"})
     ])
   : text("h1",{className:"page-header-title"},title),
  action || null
 ]);
}

export function formField(label,{tag="input",...attrs}={}){
 return h("label",{className:"form-field"},[
  text("div",{className:"form-field-label"},label),
  h(tag,tag==="textarea"?{rows:"4",...attrs}:{type:"text",...attrs})
 ]);
}