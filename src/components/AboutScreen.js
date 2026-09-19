import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
export function AboutScreen({onBack}){return h("main",{className:"screen info-screen"},[
 PageHeader({title:"About",onBack}),
 h("section",{className:"about-hero"},[
  h("img",{src:"/src/assets/scoutwave-logo.png",alt:"Scoutwave",className:"about-logo"}),
  text("span",{className:"section-kicker"},"SCOUTWAVE"),
  text("h1",{},"Football intelligence, built for clarity."),
  text("p",{},"Livescores, statistics, match intelligence and tracked prediction signals in one focused experience.")
 ]),
 h("section",{className:"info-card card"},[text("div",{className:"section-kicker"},"VERSION"),text("strong",{},"0.1.0 · Prototype")])
]);}