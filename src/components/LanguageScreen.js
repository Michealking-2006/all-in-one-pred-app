import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { languages } from "../data/mockData.js";
export function LanguageScreen({current,onSelect,onBack}){
 return h("main",{className:"screen language-screen"},[
  PageHeader({title:"Language",onBack}),
  h("section",{className:"selection-list card"},languages.map(lang=>h("button",{className:"selection-row",onClick:()=>onSelect(lang)},[text("span",{},lang),lang===current?h("i",{"data-lucide":"check"}):h("i",{"data-lucide":"chevron-right"})])))
 ]);
}