import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getPlayerProfile } from "../api/footballApi.js";
import { SkeletonImage } from "./Skeleton.js";
import { metaLine } from "../utils/ui.js";

function statRow(label, value) {
  if (value == null) return null;
  return h("div", { className: "player-stat-row" }, [
    text("span", {}, label),
    text("span", { className: "mono player-stat-value" }, value),
  ]);
}

function infoItem(label, value) {
  return value != null && value !== "" ? h("div", { className: "entity-info-item" }, [text("span", {}, label), text("strong", {}, String(value))]) : null;
}

export function PlayerPage({ id, onBack }) {
  const profilePromise = getPlayerProfile(id);
  return createTabbedPage({
    title: "Player",
    onBack,
    tabs: [
      { id: "overview", label: "Overview", load: () => profilePromise.then(renderOverview) },
      { id: "stats", label: "Statistics", load: () => profilePromise.then(renderStatistics) },
    ],
  });
}

function renderOverview(entry) {
  if (!entry) return emptyNode("Player not found.");
  const { player, statistics } = entry;
  const current = (statistics || [])[0];
  const nodes = [
    h("section", { className: "entity-hero player-hero" }, [
      SkeletonImage({ src: player.photo, size: 80, radius: "50%" }),
      text("h1", { className: "entity-title" }, player.name),
      metaLine([player.nationality, player.age ? "Age " + player.age : null], "meta-line entity-meta"),
    ]),
  ];
  if (current) {
    nodes.push(h("div", { className: "card player-club-card" }, [
      text("div", { className: "section-kicker" }, "Current club"),
      text("div", { className: "player-club-name" }, current.team?.name || "\u2013"),
      current.league?.name ? text("div", { className: "player-club-league" }, current.league.name) : null,
    ]));
  }
  const info = [
    infoItem("Position", current?.games?.position),
    infoItem("Height", player.height),
    infoItem("Weight", player.weight),
    infoItem("Born", player.birth?.date),
  ].filter(Boolean);
  if (info.length) nodes.push(h("div", { className: "entity-info-grid" }, info));
  return h("div", {}, nodes);
}

function renderStatistics(entry) {
  if (!entry?.statistics?.length) return emptyNode("No statistics available for this season.");
  return h("div", { className: "player-statistics" }, entry.statistics.map((s) =>
    h("section", { className: "card player-stat-group" }, [
      h("div", { className: "player-stat-heading" }, [
        s.team?.logo ? h("img", { src: s.team.logo, alt: "", className: "player-team-logo" }) : null,
        h("div", { className: "player-stat-title" }, [
          text("strong", {}, s.team?.name || ""),
          text("span", { className: "muted-copy" }, s.league?.name || ""),
        ]),
      ]),
      statRow("Appearances", s.games?.appearences),
      statRow("Minutes played", s.games?.minutes),
      statRow("Goals", s.goals?.total),
      statRow("Assists", s.goals?.assists),
      statRow("Yellow cards", s.cards?.yellow),
      statRow("Red cards", s.cards?.red),
      statRow("Rating", s.games?.rating ? Number(s.games.rating).toFixed(1) : null),
    ])
  ));
}
