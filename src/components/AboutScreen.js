import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { APP_VERSION } from "../config.js";
import { ABOUT_SECTIONS, renderSections } from "../legalContent.js";
export function AboutScreen({onBack}){return h("main",{className:"screen info-screen"},[
 PageHeader({title:"About",onBack}),
 h("section",{className:"about-hero"},[
  h("img",{src:"/src/assets/scoutwave-wordmark.png",alt:"Scoutwave",className:"about-logo"}),
  text("span",{className:"section-kicker"},"Scoutwave"),
  text("h1",{},"Football scores and predictions."),
  text("p",{},"Live scores, stats and odds, plus predictions from our own model, with every result tracked.")
 ]),
 h("article",{className:"legal-copy card"},renderSections(ABOUT_SECTIONS)),
 h("section",{className:"info-card card"},[text("div",{className:"section-kicker"},"Version"),text("strong",{},APP_VERSION+" (prototype)")])
]);}