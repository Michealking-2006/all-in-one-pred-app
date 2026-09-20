import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { PageHeader } from "./PageHeader.js";
import { getLeagueById, getStandings, getUpcomingFixtures, getTopScorers, searchLeagues } from "../api/footballApi.js";
import { buildSlug, slugify } from "../utils/slug.js";
import { getBestSeason, seasonLabel, statusLabel, isLive } from "../utils/fixtures.js";
import { metaLine } from "../utils/ui.js";
import { navigate } from "../router.js";

// Legacy name-slug links ("/premier-league"): resolve to an id, then move to the
// canonical /league/<id> URL so the page is bookmarkable and unambiguous.
function resolveLeagueId(slug) {
  const words = slug.replace(/-/g, " ");
  return searchLeagues(words).then((rows) => {
    const wanted = slugify(slug);
    const exact = rows.find((row) => slugify(row.league?.name || "") === wanted);
    return exact?.league?.id || rows[0]?.league?.id || null;
  });
}

const getLeague = (id) => getLeagueById(id).then((rows) => rows[0] || null);
const seasonAndEntry = (id) => getLeague(id).then((entry) => ({ entry, season: getBestSeason(entry) }));

export function LeaguePage({ id, slug, onBack }) {
  if (id) return createLeaguePage(id, onBack);

  const body = h("div", { className: "async-page-body" }, [text("div", { className: "async-empty-state" }, "Finding league\u2026")]);
  const page = h("main", { className: "screen league-page resolving-page" }, [PageHeader({ title: "League", onBack }), body]);

  const fail = (message) => {
    body.innerHTML = "";
    body.appendChild(text("div", { className: "async-error-state" }, message));
  };
  resolveLeagueId(slug)
    .then((leagueId) => {
      if (!leagueId) return fail("League not found.");
      navigate("/league/" + leagueId, { replace: true });
    })
    .catch((error) => fail(error?.message || "Unable to load league."));
  return page;
}

function createLeaguePage(id, onBack) {
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
  return getLeague(id).then((entry) => {
    if (!entry) return emptyNode("League not found.");
    const { league, country } = entry;
    const season = getBestSeason(entry);
    return h("section", { className: "league-overview" }, [
      h("div", { className: "entity-hero league-hero" }, [
        h("img", { src: league.logo, alt: league.name, className: "entity-logo" }),
        text("h1", { className: "entity-title" }, league.name),
        metaLine([country?.name || "International", league.type], "meta-line entity-meta"),
      ]),
      h("div", { className: "card league-season-card" }, [
        text("span", { className: "section-kicker" }, "Current season"),
        text("strong", { className: "mono stat-value" }, seasonLabel(entry, season)),
        text("span", { className: "muted-copy" }, "Latest season available from the football data provider."),
      ]),
    ]);
  });
}

function standingsTable(table) {
  return h("div", { className: "standings-table" }, [
    h("div", { className: "standings-row standings-head" }, [text("span", {}, "#"), text("span", {}, "Team"), text("span", {}, "P"), text("span", {}, "Pts")]),
    ...table.map((row) =>
      h("button", { className: "standings-row team", onClick: () => navigate("/club/" + buildSlug(row.team.id, row.team.name)), "aria-label": "Open " + row.team.name }, [
        text("span", { className: "mono" }, row.rank),
        h("img", { src: row.team.logo, alt: "", className: "standings-team-logo" }),
        text("strong", { className: "standings-team-name" }, row.team.name),
        text("span", { className: "mono" }, row.all?.played ?? "\u2013"),
        text("strong", { className: "mono" }, row.points ?? "\u2013"),
      ])
    ),
  ]);
}

function loadStandings(id) {
  return seasonAndEntry(id)
    .then(({ season }) => getStandings(id, season).then((rows) => ({ season, rows })))
    .then(({ season, rows }) => {
      // Cup-style competitions (e.g. Champions League) have several groups.
      const groups = (rows[0]?.league?.standings || []).filter((g) => g?.length);
      if (!groups.length) return emptyNode("Standings are not available for the " + season + " season yet.");
      if (groups.length === 1) return standingsTable(groups[0]);
      return h("div", { className: "standings-groups" }, groups.flatMap((group) => [
        text("div", { className: "section-kicker standings-group-title" }, group[0]?.group || "Group"),
        standingsTable(group),
      ]));
    });
}

function loadFixtures(id) {
  return seasonAndEntry(id)
    .then(({ season }) => getUpcomingFixtures(id, season, 12).then((fixtures) => ({ season, fixtures })))
    .then(({ season, fixtures }) => {
      if (!fixtures.length) return emptyNode("No upcoming fixtures for the " + season + " season.");
      return h("div", { className: "fixture-list" }, fixtures.map((fx) => {
        const date = new Date(fx.fixture.date);
        const live = isLive(fx.fixture.status?.short);
        const score = fx.goals?.home != null ? fx.goals.home + "\u2013" + fx.goals.away : "vs";
        return h("button", { className: "fixture-card", onClick: () => navigate("/match/" + fx.fixture.id), "aria-label": "Open match" }, [
          h("div", { className: "fixture-meta" }, [
            text("span", { className: "eyebrow" }, date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })),
            text("span", { className: "fixture-time mono" }, live ? "Live" : statusLabel(fx)),
          ]),
          h("div", { className: "fixture-teams" }, [
            h("div", { className: "fixture-team" }, [h("img", { src: fx.teams.home.logo, alt: "", className: "fixture-logo" }), text("span", {}, fx.teams.home.name)]),
            text("strong", { className: "mono fixture-vs" }, score),
            h("div", { className: "fixture-team away" }, [text("span", {}, fx.teams.away.name), h("img", { src: fx.teams.away.logo, alt: "", className: "fixture-logo" })]),
          ]),
        ]);
      }));
    });
}

function loadTopScorers(id) {
  return seasonAndEntry(id)
    .then(({ season }) => getTopScorers(id, season))
    .then((scorers) => {
      if (!scorers.length) return emptyNode("Top scorer data is not available for this season.");
      return h("div", { className: "scorers-table card" }, scorers.slice(0, 20).map((entry, index) => {
        const player = entry.player;
        const stat = entry.statistics?.[0];
        return h("button", { className: "scorer-row", onClick: () => navigate("/player/" + buildSlug(player.id, player.name)), "aria-label": "Open " + player.name }, [
          text("span", { className: "scorer-rank mono" }, index + 1),
          h("img", { src: player.photo, alt: "", className: "scorer-photo" }),
          h("span", { className: "scorer-main" }, [text("strong", { className: "scorer-name" }, player.name), text("span", { className: "scorer-club" }, stat?.team?.name || "\u2013")]),
          text("strong", { className: "scorer-goals mono" }, stat?.goals?.total ?? "\u2013"),
        ]);
      }));
    });
}
