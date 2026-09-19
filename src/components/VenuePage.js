import { h, text } from "../utils/h.js";
import { createAsyncPage } from "../utils/asyncPage.js";
import { getVenueById } from "../api/footballApi.js";
export function VenuePage({id,onBack}){return createAsyncPage({title:"Venue",onBack,fetchData:()=>getVenueById(id).then(r=>r[0]||null),notFoundMessage:"Venue not found.",renderBody:(body,v)=>{
 body.appendChild(h("section",{className:"entity-hero"},[
  v.image?h("img",{className:"venue-image",src:v.image,alt:""}):h("i",{"data-lucide":"building-2"}),
  text("h1",{className:"entity-title"},v.name),
  text("div",{className:"eyebrow"},((v.city||"")+(v.country?", "+v.country:"")).toUpperCase())
 ]));
 body.appendChild(h("div",{className:"card info-card"},[
  info("Address",v.address),info("Capacity",v.capacity?.toLocaleString()),info("Surface",v.surface)
 ]));
}});
}
function info(a,b){return b?h("div",{className:"result-row"},[text("span",{style:{color:"var(--text-muted)"}},a),text("strong",{style:{marginLeft:"auto",textAlign:"right"}},b)]):null}