import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getPlayerById } from "../api/footballApi.js";
import { SkeletonImage } from "./Skeleton.js";

function statRow(label, value) {
  if (value == null) return null;
  return h("div", { style: { display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "0.5px solid var(--border-soft)" } }, [
    text("span", { style: { fontSize: "13px", color: "var(--text-muted)" } }, label),
    text("span", { className: "mono", style: { fontSize: "13px", fontWeight: "600" } }, value),
  ]);
}

// props: { id, onBack }
export function PlayerPage({ id, onBack }) {
  // Both tabs read the same API call — memoizing here means the second tab
  // never triggers a second network request, even through the generic
  // per-tab loader in createTabbedPage.
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
  if (!entry) return emptyNode("Player not found \u2014 API-Football's player endpoint needs a season alongside the id, and results can vary by season.");
  const { player, statistics } = entry;
  const current = (statistics || [])[0];

  const nodes = [
    h("section", { className: "entity-hero" }, [
      SkeletonImage({ src: player.photo, size: 80, radius: "50%" }),
      text("div", { style: { fontWeight: "700", fontSize: "18px", margin: "12px 0 4px", textAlign: "center" } }, player.name),
      text("div", { className: "mono eyebrow" }, `${(player.nationality || "").toUpperCase()}${player.age ? ` \u00b7 AGE ${player.age}` : ""}`),
    ]),
  ];

  if (current) {
    nodes.push(
      h("div", { style: { background: "var(--surface)", borderRadius: "10px", padding: "14px" } }, [
        text("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" } }, "CURRENT CLUB"),
        text("div", { style: { fontSize: "14px", fontWeight: "600" } }, current.team?.name || "\u2014"),
        current.league?.name ? text("div", { style: { fontSize: "12px", color: "var(--text-dim)", marginTop: "2px" } }, current.league.name) : null,
      ])
    );
  }

  return h("div", {}, nodes);
}

function renderStatistics(entry) {
  if (!entry) return emptyNode("No statistics available.");
  const { statistics } = entry;
  if (!statistics || statistics.length === 0) return emptyNode("No statistics available for this season.");

  return h(
    "div",
    {},
    statistics.map((s) =>
      h("div", { style: { marginBottom: "20px" } }, [
        h("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" } }, [
          s.team?.logo ? h("img", { src: s.team.logo, alt: "", style: { width: "18px", height: "18px", objectFit: "contain" } }) : null,
          text("div", { style: { fontSize: "13px", fontWeight: "600" } }, `${s.team?.name || ""} \u00b7 ${s.league?.name || ""}`),
        ]),
        statRow("Appearances", s.games?.appearences),
        statRow("Minutes played", s.games?.minutes),
        statRow("Goals", s.goals?.total),
        statRow("Assists", s.goals?.assists),
        statRow("Yellow cards", s.cards?.yellow),
        statRow("Red cards", s.cards?.red),
        statRow("Rating", s.games?.rating ? Number(s.games.rating).toFixed(1) : null),
      ])
    )
  );
}
