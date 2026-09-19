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

function matchRow(match, favourite, props) {
  const live = match.status === "live";
  const finished = match.status === "finished";

  return h("article", { className: "ios-match-row " + (live ? "is-live" : "") }, [
    h("button", {
      className: "match-main ios-match-main",
      onClick: () => props.onOpenMatch(match.id),
      "aria-label": match.home + " vs " + match.away
    }, [
      h("div", { className: "ios-match-time" }, [
        live
          ? h("span", { className: "ios-live-status" }, [
              h("span", { className: "live-dot" }),
              text("span", {}, match.minute + "'")
            ])
          : text("span", {}, match.time),
      ]),
      h("div", { className: "ios-match-teams" }, [
        h("div", { className: "ios-team-row" }, [
          text("span", { className: "team-name" }, match.home),
          text("b", { className: "mono ios-score " + (finished ? "muted-score" : "") }, match.scoreH),
        ]),
        h("div", { className: "ios-team-row" }, [
          text("span", { className: "team-name" }, match.away),
          text("b", { className: "mono ios-score " + (finished ? "muted-score" : "") }, match.scoreA),
        ]),
      ]),
      h("div", { className: "ios-pick" }, [
        text("strong", {}, match.winner),
        text("span", { className: "mono" }, match.confidence + "%"),
      ]),
    ]),
    h("button", {
      className: "ios-favorite " + (favourite ? "selected" : ""),
      onClick: (event) => { event.stopPropagation(); props.onToggleFavorite(match.id); },
      "aria-label": favourite ? "Remove favourite" : "Add favourite"
    }, [h("i", { "data-lucide": "star", fill: favourite ? "currentColor" : "none" })]),
  ]);
}

function leagueSection(group) {
  return h("section", { className: "ios-league-section" }, [
    h("header", { className: "ios-league-header" }, [
      h("div", { className: "ios-league-title" }, [
        h("span", { className: "ios-league-dot" }),
        text("strong", {}, group.league),
      ]),
      text("span", { className: "mono ios-league-count" }, String(group.items.length)),
    ]),
    h("div", { className: "ios-match-list" },
      group.items.map((match) => matchRow(match, false, {}))
    ),
  ]);
}

export function HomeScreen(props) {
  const grouped = groups(matches);
  return h("main", { className: "screen home-screen ios-home" }, [
    h("header", { className: "home-header ios-large-header" }, [
      h("div", { className: "home-title-wrap" }, [
        text("h1", { className: "home-title" }, "Games"),
      ]),
      h("div", { className: "header-actions" }, [
        h("button", { className: "header-icon", onClick: props.onOpenSearch, "aria-label": "Search" }, [
          h("i", { "data-lucide": "search" }),
        ]),
        h("button", { className: "header-icon", onClick: props.onOpenProfile, "aria-label": "Profile" }, [
          h("i", { "data-lucide": "circle-user-round" }),
        ]),
      ]),
    ]),
    DateStrip({ selectedOffset: props.selectedDayOffset, onSelectDay: props.onSelectDay }),
    h("div", { className: "ios-home-content" },
      grouped.map((group) => h("section", { className: "ios-league-section" }, [
        h("header", { className: "ios-league-header" }, [
          h("div", { className: "ios-league-title" }, [
            h("span", { className: "ios-league-dot" }),
            text("strong", {}, group.league),
          ]),
          text("span", { className: "mono ios-league-count" }, String(group.items.length)),
        ]),
        h("div", { className: "ios-match-list" },
          group.items.map((match) => matchRow(match, props.favoriteMatchIds.includes(match.id), props))
        ),
      ]))
    ),
  ]);
}
