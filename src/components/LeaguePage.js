import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getLeagueById, getStandings, getUpcomingFixtures, getTopScorers } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";\nimport { searchLeagues } from "../api/footballApi.js";
import { navigate } from "../router.js";

const seasonCache = new Map();
function resolveSeason(id) {
  if (!seasonCache.has(id)) {
    seasonCache.set(id, getLeagueById(id).then((rows) => {
      const current = rows[0]?.seasons?.find((season) => season.current);
      return current?.year || new Date().getFullYear();
    }));
  }
  return seasonCache.get(id);
}

export function LeaguePage({ id, onBack }) {
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
    const current = seasons?.find((s) => s.current);
    return h("section", { className: "league-overview" }, [
      h("div", { className: "entity-hero league-hero" }, [
        h("img", { src: league.logo, alt: league.name, className: "entity-logo" }),
        text("h1", { className: "entity-title" }, league.name),
        text("div", { className: "mono eyebrow" }, (country?.name || "International").toUpperCase() + " · " + (league.type || "COMPETITION").toUpperCase()),
      ]),
      current ? h("div", { className: "card league-season-card" }, [
        text("span", { className: "section-kicker" }, "CURRENT SEASON"),
        text("strong", { className: "mono stat-value" }, String(current.year)),
      ]) : null,
    ]);
  });
}

function loadStandings(id) {
  return resolveSeason(id).then((season) => getStandings(id, season)).then((results) => {
    const table = results[0]?.league?.standings?.[0];
    if (!table?.length) return emptyNode("No standings available for this season.");
    return h("div", { className: "standings-table" }, [
      h("div", { className: "standings-row standings-head" }, [text("span", {}, "#"), text("span", {}, "Team"), text("span", {}, "P"), text("span", {}, "Pts")]),
      ...table.map((row) => h("button", { className: "standings-row team", onClick: () => navigate("/club/" + buildSlug(row.team.id, row.team.name)), "aria-label": "Open " + row.team.name }, [
        text("span", { className: "mono" }, row.rank),
        h("img", { src: row.team.logo, alt: "", className: "standings-team-logo" }),
        text("strong", { className: "standings-team-name" }, row.team.name),
        text("span", { className: "mono" }, row.all?.played ?? "—"),
        text("strong", { className: "mono" }, row.points ?? "—"),
      ])),
    ]);
  });
}

function loadFixtures(id) {
  return resolveSeason(id).then((season) => getUpcomingFixtures(id, season, 8)).then((fixtures) => {
    if (!fixtures.length) return emptyNode("No upcoming fixtures found.");
    return h("div", { className: "fixture-list" }, fixtures.map((fixture) => {
      const date = new Date(fixture.fixture.date);
      return h("article", { className: "fixture-card" }, [
        h("div", { className: "fixture-meta" }, [
          text("span", { className: "eyebrow" }, date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase()),
          text("span", { className: "fixture-time mono" }, date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })),
        ]),
        h("div", { className: "fixture-teams" }, [
          h("div", { className: "fixture-team" }, [h("img", { src: fixture.teams.home.logo, alt: "", className: "fixture-logo" }), text("span", {}, fixture.teams.home.name)]),
          text("strong", { className: "mono fixture-vs" }, "VS"),
          h("div", { className: "fixture-team away" }, [text("span", {}, fixture.teams.away.name), h("img", { src: fixture.teams.away.logo, alt: "", className: "fixture-logo" })]),
        ]),
      ]);
    }));
  });
}

function loadTopScorers(id) {
  return resolveSeason(id).then((season) => getTopScorers(id, season)).then((scorers) => {
    if (!scorers.length) return emptyNode("No top scorer data available for this season.");
    return h("div", { className: "scorers-table card" }, scorers.slice(0, 10).map((entry, index) => {
      const player = entry.player;
      const stat = entry.statistics?.[0];
      return h("button", { className: "scorer-row", onClick: () => navigate("/player/" + buildSlug(player.id, player.name)), "aria-label": "Open " + player.name }, [
        text("span", { className: "scorer-rank mono" }, index + 1),
        h("img", { src: player.photo, alt: player.name, className: "scorer-photo" }),
        h("span", { className: "scorer-main" }, [text("strong", { className: "scorer-name" }, player.name), text("span", { className: "scorer-club" }, stat?.team?.name || "—")]),
        text("strong", { className: "scorer-goals mono" }, stat?.goals?.total ?? "—"),
      ]);
    }));
  });
}