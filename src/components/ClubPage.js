import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getTeamById, getTeamSquad, getTeamFixtures } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

export function ClubPage({ id, onBack }) {
  return createTabbedPage({ title:"Club", onBack, tabs:[
    {id:"overview",label:"Overview",load:()=>loadOverview(id)},
    {id:"squad",label:"Squad",load:()=>loadSquad(id)},
    {id:"form",label:"Form",load:()=>loadForm(id)}
  ]});
}
function loadOverview(id){
 return getTeamById(id).then(r=>{
  const e=r[0]; if(!e) return emptyNode("Club not found.");
  const {team,venue}=e;
  return h("div",{},[
   h("section",{className:"entity-hero"},[
    h("img",{className:"entity-logo",src:team.logo,alt:""}),
    text("h1",{className:"entity-title"},team.name),
    text("div",{className:"eyebrow"},((team.country||"")+(team.founded?" · FOUNDED "+team.founded:"")).toUpperCase())
   ]),
   venue?.name?h("div",{className:"card info-card"},[
    text("div",{className:"section-kicker"},"HOME VENUE"),
    text("strong",{className:"info-card-title"},venue.name),
    text("div",{className:"info-card-meta"},venue.city?venue.city+(venue.capacity?" · "+venue.capacity.toLocaleString()+" capacity":""):"")
   ]):null
  ]);
 });
}
function loadSquad(id){
 return getTeamSquad(id).then(players=>players.length?h("div",{className:"card squad-list"},
  players.map(e=>{const p=e.player,s=e.statistics?.[0];return h("button",{className:"result-row squad-row",onClick:()=>navigate("/player/"+buildSlug(p.id,p.name))},[
   h("img",{className:"scorer-photo",src:p.photo,alt:""}),
   h("div",{className:"scorer-main"},[text("strong",{className:"scorer-name"},p.name),text("div",{className:"scorer-club"},(s?.games?.position||"").toUpperCase())]),
   text("span",{className:"mono"},p.age?p.age+"y":"")
  ])})
 ):emptyNode("Squad list not available."));
}
function loadForm(id){
 return getTeamFixtures(id,{last:6}).then(fs=>fs.length?h("div",{className:"fixture-list"},
  fs.map(f=>{const d=new Date(f.fixture.date),home=f.teams.home.id===id,o=home?f.teams.away:f.teams.home;
   return h("div",{className:"fixture-card"},[
    h("div",{className:"fixture-meta"},[text("span",{className:"eyebrow"},d.toLocaleDateString(undefined,{month:"short",day:"numeric"}).toUpperCase()),text("span",{className:"badge badge-muted"},home?"HOME":"AWAY")]),
    h("div",{className:"fixture-teams"},[
     h("div",{className:"fixture-team"},[h("img",{className:"league-logo",src:home?f.teams.home.logo:f.teams.away.logo,alt:""}),text("span",{},home?f.teams.home.name:f.teams.away.name)]),
     text("strong",{className:"mono"},f.goals.home!=null?f.goals.home+"–"+f.goals.away:"—"),
     h("div",{className:"fixture-team away"},[text("span",{},o.name),h("img",{className:"league-logo",src:o.logo,alt:""})])
    ])
   ]);
  })
 ):emptyNode("No recent fixtures found."));
}