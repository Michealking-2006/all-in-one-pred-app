import { h, text } from "../utils/h.js";
import { OddsTable } from "./OddsTable.js";
import { PredictionsPanel } from "./PredictionsPanel.js";
const TABS=["summary","predictions","odds","lineup","standings"];
export function MatchScreen({match,matchTab,isVip,coins,isFavorite,onBack,onTabChange,onRequestUpgrade,onUnlockWithCoins,onToggleFavorite}){
 if (!match) return h("main",{className:"screen match-screen match-missing"},[h("div",{className:"card match-missing-card"},[h("i",{"data-lucide":"circle-alert"}),text("strong",{},"Match unavailable"),text("span",{},"This match could not be loaded."),h("button",{className:"primary-button",onClick:onBack},"Go back")])]);
 const active=TABS.includes(matchTab)?matchTab:"summary";
 return h("main",{className:"screen match-screen"},[
  h("header",{className:"match-header"},[
   h("button",{className:"match-header-button","aria-label":"Back",onClick:onBack},[h("i",{"data-lucide":"arrow-left"})]),
   h("div",{className:"match-brand"},[h("img",{src:"/src/assets/scoutwave-logo-light-a.png",alt:"Scoutwave"})]),
   h("button",{className:"match-header-button","aria-label":isFavorite?"Remove from favorites":"Add to favorites",onClick:onToggleFavorite},[h("i",{"data-lucide":"star",fill:isFavorite?"currentColor":"none"})])
  ]),
  h("section",{className:"match-hero"},[
   text("span",{className:"match-league"},match.league),
   match.status==="live"?h("span",{className:"match-live-label"},[h("span",{className:"live-dot"}),text("span",{},match.minute+"' LIVE")]):text("span",{className:"match-status"},match.time==="FT"?"FULL TIME":"KICKOFF "+match.time),
   h("div",{className:"match-scoreboard"},[
    h("div",{className:"match-side"},[text("strong",{},match.home)]),
    h("div",{className:"match-score-big mono"},match.scoreH+" – "+match.scoreA),
    h("div",{className:"match-side away-side"},[text("strong",{},match.away)])
   ])
  ]),
  h("nav",{className:"match-tabs","aria-label":"Match sections"},TABS.map(t=>h("button",{className:"match-tab "+(active===t?"active":""),onClick:()=>onTabChange(t)},t==="odds"?"Odds":t.charAt(0).toUpperCase()+t.slice(1)))),
  renderPanel(active,match,{isVip,coins,onRequestUpgrade,onUnlockWithCoins})
 ]);
}
function renderPanel(tab,match,props){
 if(tab==="predictions")return PredictionsPanel({match,isUnlocked:props.isVip,coins:props.coins,onRequestUpgrade:props.onRequestUpgrade,onUnlockWithCoins:props.onUnlockWithCoins});
 if(tab==="odds")return OddsTable({match});
 if(tab==="lineup")return lineupPanel(match);
 if(tab==="standings")return standingsPanel(match);
 return h("section",{className:"match-panel"},[
  h("div",{className:"match-panel-block card"},[text("span",{className:"section-kicker"},"HEAD TO HEAD"),text("p",{className:"match-copy"},match.h2h || "Head-to-head data is unavailable.")]),
  h("div",{className:"match-panel-block card"},[
   text("span",{className:"section-kicker"},"RECENT FORM"),
   formRow(match.home,match.form?.home),formRow(match.away,match.form?.away)
  ])
 ]);
}
function formRow(team,form){return h("div",{className:"form-row"},[text("strong",{},team),h("div",{className:"form-badges"},form.length?form.map(v=>h("span",{className:"form-badge form-"+String(v).toLowerCase()},v)):text("span",{className:"muted-copy"},"No form data"))]);}
function playerRow(p){return h("div",{className:"lineup-row"},[text("span",{className:"lineup-number mono"},p.no),text("strong",{className:"lineup-name"},p.name),text("span",{className:"lineup-pos"},p.pos)]);}
function lineupTeam(name,formation,players){return h("div",{className:"lineup-team card"},[h("div",{className:"lineup-team-head"},[text("strong",{},name),text("span",{className:"mono"},formation)]),...players.map(playerRow)]);}
function lineupPanel(match){return h("section",{className:"match-panel"},[lineupTeam(match.home,match.lineup.formation.home,match.lineup.home),lineupTeam(match.away,match.lineup.formation.away,match.lineup.away)]);}
function standingsPanel(match){
 return h("section",{className:"match-panel"},[text("h2",{className:"panel-title"},match.standings.leagueName),h("div",{className:"standings-table"},[
  h("div",{className:"standings-row standings-head"},[text("span",{},"#"),text("span",{},"Team"),text("span",{},"P"),text("span",{},"Pts")]),
  ...match.standings.rows.map(row=>h("div",{className:"standings-row "+(match.standings.highlight.includes(row.team)?"highlight":""},[text("span",{className:"mono"},row.pos),text("strong",{},row.team),text("span",{className:"mono"},row.played),text("strong",{className:"mono"},row.points)]))
 ] )]);
}