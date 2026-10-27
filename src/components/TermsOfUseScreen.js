import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { TERMS_SECTIONS, LEGAL_UPDATED, renderSections } from "../legalContent.js";
export function TermsOfUseScreen({onBack}){return h("main",{className:"screen info-screen"},[PageHeader({title:"Terms of use",onBack}),h("article",{className:"legal-copy card"},[text("span",{className:"section-kicker"},"Legal"),text("h1",{},"Terms of use"),text("p",{className:"legal-meta"},"Last updated "+LEGAL_UPDATED),text("p",{},"Please read these terms carefully. They explain the rules for using Scoutwave, including accounts, Premium, coins, payments and the limits of what our predictions can promise."),...renderSections(TERMS_SECTIONS)])]);}
