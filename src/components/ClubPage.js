import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getTeamById, getTeamSquad, getTeamFixtures, getTeamStatistics, getTeamLeagues } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

function currentSeason(rows) {
  const seasons = (rows || []).flatMap((x) => x.seasons || []).filter((s) => Number.isInteger(s?.year));
  return seasons.find((s) => s.current)?.year || seasons.sort((a,b)=>b.year-a.year)[0]?.year || new Date().getFullYear();
}
function resolveContext(id) {
  return getTeamLeagues(id).then((rows) => {
    const entry = rows[0];
    const league = entry?.league;
    const season = currentSeason(entry ? [entry] : []);
    return { leagueId: league?.id || null, season };
  }).catch(() => ({ leagueId:null, season:new Date().getFullYear() }));
}
export function ClubPage({ id, onBack }) {
  return createTabbedPage({ title:"Club", onBack, tabs:[
    {id:"overview",label:"Overview",load:()=>loadOverview(id)},
    {id:"matches",label:"Matches",load:()=>loadMatches(id)},
    {id:"squad",label:"Squad",load:()=>loadSquad(id)},
    {id:"stats",label:"Stats",load:()=>loadStats(id)}
  ]});
}
function loadOverview(id){
 return getTeamById(id).then(r=>{
  const e=r[0]; if(!e) return emptyNode("Club not found.");
  const {team,venue}=e;
  return h("div",{},[
   h("section",{className:"entity-hero"},[
    h("img",{className:"entity-logo",src:team.logo,alt:team.name}),
    text("h1",{className:"entity-title"},team.name),
    text("div",{className:"eyebrow"},((team.country||"")+(team.founded?" · FOUNDED "+team.founded:"")).toUpperCase())
   ]),
   h("div",{className:"entity-info-grid"},[
    info("Country",team.country),info("Founded",team.founded),info("Stadium",venue?.name),info("Capacity",venue?.capacity?.toLocaleString()),info("City",venue?.city)
   ]),
   venue?.id ? h("button",{className:"card info-card",onClick:()=>navigate("/venue/"+buildSlug(venue.id,venue.name))},[
    text("div",{className:"section-kicker"},"HOME VENUE"),text("strong",{className:"info-card-title"},venue.name),
    text("div",{className:"info-card-meta"},venue.city||"")
   ]) : null
  ]);
 });
}
function loadMatches(id){
 return getTeamFixtures(id,{last:8,next:8}).then(fs=>fs.length?h("div",{className:"fixture-list"},fs.map(f=>{
  const d=new Date(f.fixture.date), home=f.teams.home.id===id, status=f.fixture.status?.short;
  const score=f.goals?.home!=null?`${f.goals.home}–${f.goals.away}`:"VS";
  return h("button",{className:"fixture-card",onClick:()=>navigate("/match/"+f.fixture.id),"aria-label":"Open match"},[
   h("div",{className:"fixture-meta"},[text("span",{className:"eyebrow"},d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}).toUpperCase()),text("span",{className:"fixture-time mono"},status||"")]),
   h("div",{className:"fixture-teams"},[
    h("div",{className:"fixture-team"},[h("img",{className:"fixture-logo",src:f.teams.home.logo,alt:""}),text("span",{},f.teams.home.name)]),
    text("strong",{className:"mono fixture-vs"},score),
    h("div",{className:"fixture-team away"},[text("span",{},f.teams.away.name),h("img",{className:"fixture-logo",src:f.teams.away.logo,alt:""})])
   ])
  ]);
 })):emptyNode("No recent or upcoming fixtures are available."));
}
function loadSquad(id){
 return resolveContext(id).then(({season})=>getTeamSquad(id)).then(players=>players.length?h("div",{className:"card squad-list"},players.map(e=>{
  const p=e.player,s=e.statistics?.[0];
  return h("button",{className:"result-row squad-row",onClick:()=>navigate("/player/"+buildSlug(p.id,p.name)), "aria-label":"Open "+p.name},[
   h("img",{className:"scorer-photo",src:p.photo,alt:""}),h("div",{className:"scorer-main"},[
    text("strong",{className:"scorer-name"},p.name),text("div",{className:"scorer-club"},(s?.games?.position||"").toUpperCase())
   ]),text("span",{className:"mono"},p.age?p.age+"y":"")
  ]);
 })):emptyNode("Squad data is not available for this season."));
}
function loadStats(id){
 return resolveContext(id).then(({leagueId,season})=>{
  if(!leagueId) return null;
  return getTeamStatistics(id,leagueId,season);
 }).then(data=>{
  if(!data) return emptyNode("Team statistics need a league context.");
  const g=data[0]?.fixtures, goals=data[0]?.goals, form=data[0]?.form;
  return h("div",{className:"team-stat-grid"},[
   statCard("Form",form||"—"),statCard("Matches played",g?.played?.total??"—"),statCard("Wins",g?.wins?.total??"—"),
   statCard("Draws",g?.draws?.total??"—"),statCard("Losses",g?.loses?.total??"—"),
   statCard("Goals for",goals?.for?.total?.total??"—"),statCard("Goals against",goals?.against?.total?.total??"—")
  ]);
 });
}
function info(label,value){return value!=null&&value!==""?h("div",{className:"entity-info-item"},[text("span",{},label),text("strong",{},String(value))]):null;}
function statCard(label,value){return h("div",{className:"card team-stat-card"},[text("span",{className:"section-kicker"},label),text("strong",{className:"mono"},String(value))]);}
