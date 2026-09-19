import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
export function ReportIssueScreen({onBack}){
 return h("main",{className:"screen account-form-screen"},[
  PageHeader({title:"Report an issue",onBack}),
  h("section",{className:"form-card card"},[
   h("label",{className:"form-field"},[text("span",{className:"form-field-label"},"Issue type"),h("select",{},["Bug or crash","Incorrect odds","Payment or coins issue","Something else"].map(v=>text("option",{},v)))]),
   h("label",{className:"form-field"},[text("span",{className:"form-field-label"},"Describe the issue"),h("textarea",{rows:"6",placeholder:"What happened, and what did you expect instead?"})]),
   h("button",{className:"primary-button",onClick:onBack},"Submit report")
  ])
 ]);
}