import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
export function ChangePasswordScreen({onBack}){
 return h("main",{className:"screen account-form-screen"},[
  PageHeader({title:"Change password",onBack}),
  h("section",{className:"form-card card"},[
   field("Current password","password"),field("New password","password"),field("Confirm new password","password"),
   h("button",{className:"primary-button",onClick:onBack},"Update password")
  ])
 ]);
}
function field(label,type){return h("label",{className:"form-field"},[text("span",{className:"form-field-label"},label),h("input",{type,autocomplete:"off"})]);}