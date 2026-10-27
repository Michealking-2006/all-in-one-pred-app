import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { PRIVACY_SECTIONS, LEGAL_UPDATED, renderSections } from "../legalContent.js";
export function PrivacyPolicyScreen({onBack}){return h("main",{className:"screen info-screen"},[PageHeader({title:"Privacy policy",onBack}),h("article",{className:"legal-copy card"},[text("span",{className:"section-kicker"},"Legal"),text("h1",{},"Privacy policy"),text("p",{className:"legal-meta"},"Last updated "+LEGAL_UPDATED),text("p",{},"Your privacy matters to us. This policy explains in plain language what Scoutwave collects, why, and the choices you have."),...renderSections(PRIVACY_SECTIONS)])]);}
