import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getPlayerById } from "../api/footballApi.js";
import { SkeletonImage } from "./Skeleton.js";

function statRow(label, value) {
  if (value == null) return null;
  return h("div", { className: "player-stat-row" }, [
    text("span", {}, label),
    text("span", { className: "mono player-stat-value" }, value),
  ]);
}

export function PlayerPage({ id, onBack }) {
  const fetchPromise = getPlayerById(id).then((results) => results[0] || null);
  return createTabbedPage({
    title: "Player",
    onBack,
    tabs: [
      { id: "overview", label: "Overview", load: () => fetchPromise.then(renderOverview) },
      { id: "stats", label: "Statistics", load: () => fetchPromise.then(renderStatistics) },
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
      text("div", { className: "mono eyebrow" }, ((player.nationality || "") + (player.age ? " · AGE " + player.age : "")).toUpperCase()),
    ]),
  ];
  if (current) nodes.push(h("div", { className: "card player-club-card" }, [
    text("div", { className: "section-kicker" }, "CURRENT CLUB"),
    text("div", { className: "player-club-name" }, current.team?.name || "—"),
    current.league?.name ? text("div", { className: "player-club-league" }, current.league.name) : null,
  ]));
  return h("div", {}, nodes);
}

function renderStatistics(entry) {
  if (!entry?.statistics?.length) return emptyNode("No statistics available for this season.");
  return h("div", { className: "player-statistics" }, entry.statistics.map((s) =>
    h("section", { className: "card player-stat-group" }, [
      h("div", { className: "player-stat-heading" }, [
        s.team?.logo ? h("img", { src: s.team.logo, alt: "", className: "player-team-logo" }) : null,
        text("strong", {}, (s.team?.name || "") + " · " + (s.league?.name || "")),
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
