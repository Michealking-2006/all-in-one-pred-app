import { h, text } from "../utils/h.js";
import { matches } from "../data/mockData.js";
import { PageHeader } from "./PageHeader.js";

export function FavoritesScreen({ favoriteMatchIds, onToggleFavorite, onOpenMatch, onBack }) {
 const favorited=matches.filter(m=>favoriteMatchIds.includes(m.id));
 return h("main",{className:"screen favorites-screen"},[
  PageHeader({title:"My favourites",onBack}),
  h("section",{className:"favorites-intro"},[
   text("span",{className:"section-kicker"},"YOUR WATCHLIST"),
   text("h1",{},"Matches you follow."),
   text("p",{},"Your saved games stay one tap away.")
  ]),
  favorited.length===0
   ? h("section",{className:"empty-card card"},[h("div",{className:"empty-icon"},[h("i",{"data-lucide":"star"})]),text("strong",{},"No favourites yet"),text("p",{},"Tap the star on any match to keep it here.")])
   : h("section",{className:"favorites-list"},favorited.map(m=>h("article",{className:"favorite-card"},[
      h("button",{className:"favorite-card-main",onClick:()=>onOpenMatch(m.id)},[
       h("div",{className:"favorite-card-meta"},[text("span",{className:"eyebrow"},m.league),text("span",{className:"badge "+(m.status==="live"?"badge-live":"badge-muted")},m.status==="live"?m.minute+"'":m.time)]),
       h("div",{className:"favorite-match"},[
        h("div",{className:"favorite-team-stack"},[text("strong",{},m.home),text("strong",{},m.away)]),
        h("div",{className:"favorite-score mono"},[text("span",{},m.scoreH),text("span",{},m.scoreA)])
       ]),
       h("div",{className:"favorite-signal"},[text("span",{className:"section-kicker"},"SIGNAL"),text("strong",{},m.winner),text("span",{className:"confidence"},m.confidence+"%")])
      ]),
      h("button",{className:"favorite-remove",onClick:()=>onToggleFavorite(m.id),"aria-label":"Remove from favourites"},[h("i",{"data-lucide":"star",fill:"currentColor"})])
   ])))
 ]);
}
