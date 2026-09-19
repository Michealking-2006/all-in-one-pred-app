import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getLeagueById, getStandings, getUpcomingFixtures, getTopScorers } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

// Resolved once (from the base league fetch) and shared by every tab that
// needs a season — standings/fixtures/scorers all require one.
let seasonPromise = null;
function resolveSeason(id) {
  if (!seasonPromise) {
    seasonPromise = getLeagueById(id).then((r) => {
      const current = (r[0]?.seasons || []).find((s) => s.current);
      return current?.year || new Date().getFullYear();
    });
  }
  return seasonPromise;
}

// props: { id, onBack }
export function LeaguePage({ id, onBack }) {
  seasonPromise = null; // fresh per page mount — a different league needs its own season lookup

  return createTabbedPage({
    title: "League",
    onBack,
    tabs: [
      { id: "overview", label: "Overview", load: () => loadOverview(id) },
      { id: "standings", label: "Standings", load: () => loadStandings(id) },
      { id: "fixtures", label: "Fixtures", load: () => loadFixtures(id) },
      { id: "scorers", label: "Top scorers", load: () => loadTopScorers(id) },
    ],
  });
}

function loadOverview(id) {
  return getLeagueById(id).then((results) => {
    const entry = results[0];
    if (!entry) return emptyNode("League not found.");
    const { league, country, seasons } = entry;
    const current = (seasons || []).find((s) => s.current);
    return h("div", {}, [
      h("section", { className: "entity-hero league-hero" }, [
        h("img", { src: league.logo, alt: "", className: "entity-logo" }),
        text("div", { className: "entity-title" }, league.name),
        text("div", { className: "mono eyebrow" }, `${(country?.name || "").toUpperCase()} \u00b7 ${(league.type || "").toUpperCase()}`),
      ]),
      current
        ? h("div", { className: "card league-season-card" }, [
            text("div", { className: "section-kicker" }, "CURRENT SEASON"),
            text("div", { className: "mono", className: "mono stat-value" }, String(current.year)),
          ])
        : null,
    ]);
  });
}

function loadStandings(id) {
  return resolveSeason(id)
    .then((season) => getStandings(id, season))
    .then((results) => {
      const table = results[0]?.league?.standings?.[0];
      if (!table || table.length === 0) return emptyNode("No standings available for this season.");

      const header = h("div", { className: "mono eyebrow", style: { display: "flex", alignItems: "center", gap: "10px", paddingBottom: "6px", borderBottom: "0.5px solid var(--border)" } }, [
        text("div", { style: { width: "18px" } }, "#"),
        text("div", { style: { width: "20px" } }, ""),
        text("div", { style: { flex: "1" } }, "TEAM"),
        text("div", { style: { width: "24px", textAlign: "right" } }, "P"),
        text("div", { style: { width: "32px", textAlign: "right" } }, "PTS"),
      ]);

      const rows = table.map((row) =>
        h(
          "div",
          {
            role: "button",
            tabindex: "0",
            onClick: () => navigate(`/club/${buildSlug(row.team.id, row.team.name)}`),
            style: { display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: "0.5px solid var(--border-soft)" },
          },
          [
            text("div", { className: "mono", style: { width: "18px", fontSize: "12px", color: "var(--text-muted)" } }, row.rank),
            h("img", { src: row.team.logo, alt: "", style: { width: "20px", height: "20px", objectFit: "contain", flexShrink: "0" } }),
            text("div", { style: { flex: "1", fontSize: "13px", fontWeight: "500" } }, row.team.name),
            text("div", { className: "mono", style: { width: "24px", textAlign: "right", fontSize: "12px", color: "var(--text-muted)" } }, row.all.played),
            text("div", { className: "mono", style: { width: "32px", textAlign: "right", fontSize: "13px", fontWeight: "700" } }, row.points),
          ]
        )
      );

      return h("div", {}, [header, ...rows]);
    });
}

function loadFixtures(id) {
  return resolveSeason(id)
    .then((season) => getUpcomingFixtures(id, season, 8))
    .then((fixtures) => {
      if (fixtures.length === 0) return emptyNode("No upcoming fixtures found.");
      return h(
        "div",
        {},
        fixtures.map((f) => {
          const date = new Date(f.fixture.date);
          const dateLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return h("div", { style: { padding: "12px 0", borderBottom: "0.5px solid var(--border-soft)" } }, [
            text("div", { className: "mono eyebrow", style: { marginBottom: "6px" } }, `${dateLabel.toUpperCase()} \u00b7 ${f.fixture.venue?.name || ""}`),
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
              h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
                h("img", { src: f.teams.home.logo, alt: "", style: { width: "18px", height: "18px", objectFit: "contain" } }),
                text("span", { style: { fontSize: "13px" } }, f.teams.home.name),
              ]),
              text("span", { style: { fontSize: "11px", color: "var(--text-muted)" } }, "vs"),
              h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
                text("span", { style: { fontSize: "13px" } }, f.teams.away.name),
                h("img", { src: f.teams.away.logo, alt: "", style: { width: "18px", height: "18px", objectFit: "contain" } }),
              ]),
            ]),
          ]);
        })
      );
    });
}

function loadTopScorers(id) {
  return resolveSeason(id)
    .then((season) => getTopScorers(id, season))
    .then((scorers) => {
      if (scorers.length === 0) return emptyNode("No top scorer data available for this season.");
      return h(
        "div",
        {},
        scorers.slice(0, 10).map((entry, i) => {
          const { player, statistics } = entry;
          const stat = statistics[0];
          return h(
            "div",
            {
              role: "button",
              tabindex: "0",
              onClick: () => navigate(`/player/${buildSlug(player.id, player.name)}`),
              style: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "0.5px solid var(--border-soft)" },
            },
            [
              text("div", { className: "mono", style: { width: "18px", fontSize: "12px", color: "var(--text-muted)" } }, i + 1),
              h("img", { src: player.photo, alt: "", style: { width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", flexShrink: "0" } }),
              h("div", { style: { flex: "1", minWidth: "0" } }, [
                text("div", { style: { fontSize: "13px", fontWeight: "500" } }, player.name),
                text("div", { className: "mono eyebrow", style: { marginTop: "2px" } }, (stat?.team?.name || "").toUpperCase()),
              ]),
              text("div", { className: "mono", style: { fontSize: "16px", fontWeight: "700", color: "var(--accent)" } }, stat?.goals?.total ?? "\u2014"),
            ]
          );
        })
      );
    });
}
