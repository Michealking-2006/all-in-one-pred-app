import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { APP_VERSION } from "../config.js";
export function AboutScreen({onBack}){return h("main",{className:"screen info-screen"},[
 PageHeader({title:"About",onBack}),
 h("section",{className:"about-hero"},[
  h("img",{src:"/src/assets/scoutwave-wordmark.png",alt:"Scoutwave",className:"about-logo"}),
  text("span",{className:"section-kicker"},"Scoutwave"),
  text("h1",{},"Football intelligence, built for clarity."),
  text("p",{},"Livescores, statistics, match intelligence and tracked prediction signals in one focused experience.")
 ]),
 h("section",{className:"info-card card"},[text("div",{className:"section-kicker"},"Version"),text("strong",{},APP_VERSION+" (prototype)")])
]);}