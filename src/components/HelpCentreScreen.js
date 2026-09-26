import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { faqItems } from "../data/mockData.js";
export function HelpCentreScreen({onBack}){
 return h("main",{className:"screen help-screen"},[
  PageHeader({title:"Help centre",onBack}),
  h("section",{className:"settings-intro"},[
   text("span",{className:"section-kicker"},"Support"),
   text("h1",{},"How can we help?"),
   text("p",{},"Answers to common questions about Scoutwave.")
  ]),
  h("section",{className:"faq-list card"},faqItems.map((item,i)=>h("details",{className:"faq-item",open:i===0},[
   h("summary",{},[text("span",{},item.q),h("i",{"data-lucide":"chevron-down"})]),
   text("p",{},item.a)
  ])))
 ]);
}
