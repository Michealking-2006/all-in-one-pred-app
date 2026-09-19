import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getLeagueById, getStandings, getUpcomingFixtures, getTopScorers, searchLeagues } from "../api/footballApi.js";
import { buildSlug, slugify } from "../utils/slug.js";
import { navigate } from "../router.js";

function getBestSeason(entry) {
  const seasons = Array.isArray(entry?.seasons) ? entry.seasons.filter((s) => Number.isInteger(s?.year)) : [];
  return seasons.find((s) => s.current)?.year || seasons.sort((a, b) => b.year - a.year)[0]?.year || new Date().getFullYear();
}
function resolveLeagueId(slug) {
  return searchLeagues(slug).then((rows) => {
    const wanted = slugify(slug);
    const exact = rows.find((row) => slugify(row.league?.name || "") === wanted);
    return exact?.league?.id || rows[0]?.league?.id || null;
  });
}
function getLeague(id) { return getLeagueById(id).then((rows) => rows[0] || null); }
function seasonAndId(id) { return getLeague(id).then((entry) => ({ entry, season: getBestSeason(entry) })); }

export function LeaguePage({ id, slug, onBack }) {
  if (id) return createLeaguePage(id, onBack);
  const page = h("main", { className: "screen league-page resolving-page" }, [
    text("span", { className: "section-kicker" }, "COMPETITION"), text("h1", {}, "Loading league…")
  ]);
  resolveLeagueId(slug).then((leagueId) => {
    if (!leagueId) return page.replaceWith(emptyNode("League not found."));
    page.replaceWith(createLeaguePage(leagueId, onBack));
  }).catch((error) => page.replaceWith(emptyNode(error.message || "Unable to load league.")));
  return page;
}

function createLeaguePage(id, onBack) {
  return createTabbedPage({
    title: "League", onBack,
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
        text("div", { className: "mono eyebrow" }, ((country?.name || "International") + " · " + (league.type || "COMPETITION")).toUpperCase()),
      ]),
      h("div", { className: "card league-season-card" }, [
        text("span", { className: "section-kicker" }, "LATEST DATA"),
        text("strong", { className: "mono stat-value" }, String(season)),
        text("span", { className: "muted-copy" }, "Season currently available from the football data provider."),
      ]),
    ]);
  });
}
function loadStandings(id) {
  return seasonAndId(id).then(({ season }) => getStandings(id, season).then((rows) => ({ season, rows }))).then(({ season, rows }) => {
    const table = rows[0]?.league?.standings?.[0];
    if (!table?.length) return emptyNode(`Standings are not available for the ${season} season yet.`);
    return h("div", { className: "standings-table" }, [
      h("div", { className: "standings-row standings-head" }, [text("span", {}, "#"), text("span", {}, "Team"), text("span", {}, "P"), text("span", {}, "Pts")]),
      ...table.map((row) => h("button", { className: "standings-row team", onClick: () => navigate("/club/" + buildSlug(row.team.id, row.team.name)), "aria-label": "Open " + row.team.name }, [
        text("span", { className: "mono" }, row.rank), h("img", { src: row.team.logo, alt: "", className: "standings-team-logo" }),
        text("strong", { className: "standings-team-name" }, row.team.name), text("span", { className: "mono" }, row.all?.played ?? "—"), text("strong", { className: "mono" }, row.points ?? "—")
      ]))
    ]);
  });
}
function loadFixtures(id) {
  return seasonAndId(id).then(({ season }) => getUpcomingFixtures(id, season, 12).then((fixtures) => ({ season, fixtures }))).then(({ season, fixtures }) => {
    if (!fixtures.length) return emptyNode(`No fixtures are available for the ${season} season yet.`);
    return h("div", { className: "fixture-list" }, fixtures.map((fixture) => {
      const date = new Date(fixture.fixture.date);
      const status = fixture.fixture.status?.short;
      const live = ["1H","HT","2H","ET","BT","P","LIVE"].includes(status);
      const score = fixture.goals?.home != null ? `${fixture.goals.home}–${fixture.goals.away}` : "VS";
      return h("button", { className: "fixture-card", onClick: () => navigate("/match/" + fixture.fixture.id), "aria-label": "Open match" }, [
        h("div", { className: "fixture-meta" }, [text("span", { className: "eyebrow" }, date.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" }).toUpperCase()), text("span", { className: "fixture-time mono" }, live ? "LIVE" : score === "VS" ? date.toLocaleTimeString(undefined, {hour:"2-digit",minute:"2-digit"}) : status === "FT" ? "FULL TIME" : status || "")]),
        h("div", { className: "fixture-teams" }, [
          h("div", { className: "fixture-team" }, [h("img", { src: fixture.teams.home.logo, alt:"", className:"fixture-logo" }), text("span", {}, fixture.teams.home.name)]),
          text("strong", { className:"mono fixture-vs" }, score),
          h("div", { className:"fixture-team away" }, [text("span", {}, fixture.teams.away.name), h("img", { src: fixture.teams.away.logo, alt:"", className:"fixture-logo" })])
        ])
      ]);
    }));
  });
}
function loadTopScorers(id) {
  return seasonAndId(id).then(({ season }) => getTopScorers(id, season)).then((scorers) => {
    if (!scorers.length) return emptyNode("Top scorer data is not available for this season.");
    return h("div", { className:"scorers-table card" }, scorers.slice(0, 20).map((entry,index) => {
      const player=entry.player, stat=entry.statistics?.[0];
      return h("button",{className:"scorer-row",onClick:()=>navigate("/player/"+buildSlug(player.id,player.name)),"aria-label":"Open "+player.name},[
        text("span",{className:"scorer-rank mono"},index+1), h("img",{src:player.photo,alt:player.name,className:"scorer-photo"}),
        h("span",{className:"scorer-main"},[text("strong",{className:"scorer-name"},player.name),text("span",{className:"scorer-club"},stat?.team?.name||"—")]),
        text("strong",{className:"scorer-goals mono"},stat?.goals?.total??"—")
      ]);
    }));
  });
}
