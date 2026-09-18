import { h, text } from "../utils/h.js";
import { matches, trackRecord } from "../data/mockData.js";
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
    h("button", { className: "match-main", onClick: () => props.onOpenMatch(m.id) }, [
      h("div", { className: "match-team-line" }, [text("span", { className: "team-name" }, m.home), text("b", { className: "mono match-score" }, m.scoreH)]),
      h("div", { className: "match-team-line" }, [text("span", { className: "team-name" }, m.away), text("b", { className: "mono match-score" }, m.scoreA)]),
    ]),
    h("div", { className: "match-pick" }, [text("span", { className: "eyebrow" }, "SIGNAL"), text("strong", {}, m.winner), text("span", { className: "confidence" }, m.confidence + "%")]),
    h("button", { className: "icon-button favorite-button " + (fav ? "selected" : ""), onClick: (e) => { e.stopPropagation(); props.onToggleFavorite(m.id); }, "aria-label": fav ? "Remove favourite" : "Add favourite" }, [
      h("i", { "data-lucide": "star", fill: fav ? "currentColor" : "none" })
    ])
  ]);
}

export function HomeScreen(props) {
  const top = [...matches].sort((a,b) => b.confidence - a.confidence)[0];
  return h("main", { className: "screen home-screen" }, [
    h("header", { className: "home-header" }, [
      h("div", { className: "brand-lockup" }, [
        h("div", { className: "brand-mark" }, "S"),
        h("div", {}, [text("strong", {}, "Scoutwave"), text("span", {}, "FOOTBALL INTELLIGENCE")])
      ]),
      h("div", { className: "header-actions" }, [
        h("button", { className: "header-icon", onClick: props.onOpenSearch, "aria-label": "Search" }, [h("i", { "data-lucide": "search" })]),
        h("button", { className: "header-icon", onClick: props.onOpenProfile, "aria-label": "Profile" }, [h("i", { "data-lucide": "circle-user-round" })])
      ])
    ]),
    h("section", { className: "home-hero" }, [
      h("div", { className: "hero-copy" }, [
        text("span", { className: "eyebrow" }, "MATCH CENTRE"),
        text("h1", {}, "Read the game before it starts."),
        text("p", {}, "Live scores, form and prediction signals in one place.")
      ]),
      h("div", { className: "hero-stat" }, [text("strong", {}, trackRecord.overall + "%"), text("span", {}, "30-TIP HIT RATE")])
    ]),
    DateStrip({ selectedOffset: props.selectedDayOffset, onSelectDay: props.onSelectDay }),
    h("button", { className: "featured-tip", onClick: props.onOpenVip }, [
      h("div", { className: "featured-tip-icon" }, [h("i", { "data-lucide": "sparkles" })]),
      h("div", { className: "featured-tip-copy" }, [
        text("span", { className: "eyebrow featured-accent" }, "SCOUTWAVE VIP"),
        text("strong", {}, "Today's strongest signal"),
        text("span", {}, top.home + " vs " + top.away + " · " + top.confidence + "% confidence")
      ]),
      h("i", { "data-lucide": "arrow-up-right", className: "featured-arrow" })
    ]),
    h("div", { className: "home-content" }, [
      h("div", { className: "section-heading" }, [
        h("div", {}, [text("span", { className: "section-kicker" }, "TODAY"), text("h2", {}, "Matches")]),
        text("span", { className: "muted-count" }, matches.length + " games")
      ]),
      ...groups(matches).map((g) => h("section", { className: "league-group" }, [
        h("div", { className: "league-group-header" }, [
          h("span", { className: "league-bullet" }), text("strong", {}, g.league), text("span", { className: "mono" }, g.items.length)
        ]),
        ...g.items.map((m) => matchCard(m, props.favoriteMatchIds.includes(m.id), props))
      ]))
    ])
  ]);
}
