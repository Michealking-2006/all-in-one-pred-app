import { h, text } from "../utils/h.js";
import { matches } from "../data/mockData.js";
import { DateStrip } from "./DateStrip.js";

function groups(list) {
  return list.reduce((out, m) => {
    let g = out.find((x) => x.league === m.league);
    if (!g) out.push(g = { league: m.league, items: [] });
    g.items.push(m);
    return out;
  }, []);
}

function matchCard(m, fav, props) {
  const live = m.status === "live";
  return h("article", { className: "match-card " + (live ? "match-card-live" : "") }, [
    h("div", { className: "match-meta" }, [
      live ? h("span", { className: "badge badge-live" }, [h("span", { className: "live-dot" }), text("span", {}, m.minute + "'")]) : null,
      text("span", { className: "match-time" }, m.time),
    ]),
    h("button", { className: "match-main", onClick: () => props.onOpenMatch(m.id), "aria-label": `${m.home} vs ${m.away}` }, [
      h("div", { className: "match-team-line" }, [text("span", { className: "team-name" }, m.home), text("b", { className: "mono match-score" }, m.scoreH)]),
      h("div", { className: "match-team-line" }, [text("span", { className: "team-name" }, m.away), text("b", { className: "mono match-score" }, m.scoreA)]),
    ]),
    h("div", { className: "match-pick" }, [
      text("strong", {}, m.winner),
      text("span", { className: "confidence" }, m.confidence + "%"),
    ]),
    h("button", { className: "icon-button favorite-button " + (fav ? "selected" : ""), onClick: (e) => { e.stopPropagation(); props.onToggleFavorite(m.id); }, "aria-label": fav ? "Remove favourite" : "Add favourite" }, [
      h("i", { "data-lucide": "star", fill: fav ? "currentColor" : "none" }),
    ]),
  ]);
}

export function HomeScreen(props) {
  return h("main", { className: "screen home-screen" }, [
    h("header", { className: "home-header" }, [
      h("div", { className: "brand-lockup" }, [
        h("div", { className: "brand-mark" }, "S"),
        h("strong", {}, "Scoutwave"),
      ]),
      h("div", { className: "header-actions" }, [
        h("button", { className: "header-icon", onClick: props.onOpenSearch, "aria-label": "Search" }, [h("i", { "data-lucide": "search" })]),
        h("button", { className: "header-icon", onClick: props.onOpenProfile, "aria-label": "Profile" }, [h("i", { "data-lucide": "circle-user-round" })]),
      ]),
    ]),
    DateStrip({ selectedOffset: props.selectedDayOffset, onSelectDay: props.onSelectDay }),
    h("div", { className: "home-content" }, [
      h("div", { className: "section-heading compact" }, [
        h("h2", {}, "Matches"),
        text("span", { className: "muted-count" }, matches.length + " games"),
      ]),
      ...groups(matches).map((g) => h("section", { className: "league-group" }, [
        h("div", { className: "league-group-header" }, [
          text("strong", {}, g.league),
          text("span", { className: "mono" }, g.items.length),
        ]),
        ...g.items.map((m) => matchCard(m, props.favoriteMatchIds.includes(m.id), props)),
      ])),
    ]),
  ]);
}
