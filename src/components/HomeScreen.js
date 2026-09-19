import { h, text } from "../utils/h.js";
import { matches } from "../data/mockData.js";
import { DateStrip } from "./DateStrip.js";

function groups(list) {
  return list.reduce((out, match) => {
    let group = out.find((item) => item.league === match.league);
    if (!group) out.push(group = { league: match.league, items: [] });
    group.items.push(match);
    return out;
  }, []);
}

function matchCard(match, favourite, props) {
  const live = match.status === "live";
  const finished = match.status === "finished";
  return h("article", { className: "match-card polished-match-card " + (live ? "match-card-live" : "") }, [
    h("div", { className: "match-status-column" }, [
      live
        ? h("span", { className: "live-pill" }, [
            h("span", { className: "live-dot" }),
            text("span", {}, match.minute + "'")
          ])
        : text("span", { className: "match-time" }, match.time),
    ]),
    h("button", {
      className: "match-main",
      onClick: () => props.onOpenMatch(match.id),
      "aria-label": match.home + " vs " + match.away
    }, [
      h("div", { className: "match-team-line" }, [
        text("span", { className: "team-name" }, match.home),
        text("b", { className: "mono match-score " + (finished ? "muted-score" : "") }, match.scoreH),
      ]),
      h("div", { className: "match-team-line" }, [
        text("span", { className: "team-name" }, match.away),
        text("b", { className: "mono match-score " + (finished ? "muted-score" : "") }, match.scoreA),
      ]),
    ]),
    h("div", { className: "match-prediction" }, [
      text("span", { className: "prediction-chip" }, match.winner),
      text("span", { className: "prediction-confidence mono" }, match.confidence + "%"),
    ]),
    h("button", {
      className: "icon-button favorite-button " + (favourite ? "selected" : ""),
      onClick: (event) => { event.stopPropagation(); props.onToggleFavorite(match.id); },
      "aria-label": favourite ? "Remove favourite" : "Add favourite"
    }, [h("i", { "data-lucide": "star", fill: favourite ? "currentColor" : "none" })]),
  ]);
}

function leagueHeader(name, count) {
  return h("div", { className: "league-header" }, [
    h("span", { className: "league-accent" }),
    text("strong", {}, name),
    text("span", { className: "league-count mono" }, count),
    h("i", { className: "league-chevron", "data-lucide": "chevron-right", "aria-hidden": "true" }),
  ]);
}

export function HomeScreen(props) {
  const grouped = groups(matches);
  const liveCount = matches.filter((match) => match.status === "live").length;
  return h("main", { className: "screen home-screen" }, [
    h("header", { className: "home-header ios-large-header" }, [
      h("div", { className: "home-title-wrap" }, [
        text("span", { className: "home-greeting" }, "Scoutwave"),
        text("h1", { className: "home-title" }, "Games"),
      ]),
      h("div", { className: "header-actions" }, [
        liveCount ? h("span", { className: "home-live-count" }, [
          h("span", { className: "live-dot" }),
          text("span", {}, liveCount + " Live"),
        ]) : null,
        h("button", { className: "header-icon", onClick: props.onOpenSearch, "aria-label": "Search" }, [
          h("i", { "data-lucide": "search" }),
        ]),
        h("button", { className: "header-icon", onClick: props.onOpenProfile, "aria-label": "Profile" }, [
          h("i", { "data-lucide": "circle-user-round" }),
        ]),
      ]),
    ]),
    DateStrip({ selectedOffset: props.selectedDayOffset, onSelectDay: props.onSelectDay }),
    h("div", { className: "home-content" },
      grouped.map((group) => h("section", { className: "league-group" }, [
        leagueHeader(group.league, group.items.length),
        ...group.items.map((match) => matchCard(match, props.favoriteMatchIds.includes(match.id), props)),
      ]))
    ),
  ]);
}
