import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode, skeletonBlock, errorNode } from "../utils/tabbedPage.js";
import { PageHeader } from "./PageHeader.js";
import {
  getLeagueById, getStandings, getUpcomingFixtures, getTopScorers, getTopAssists, getTopYellowCards,
  getTopRedCards, searchLeagues, getLeagueTeams, getLeagueFixtures,
} from "../api/footballApi.js";
import { buildSlug, slugify } from "../utils/slug.js";
import { getBestSeason, seasonLabel, formatDate } from "../utils/fixtures.js";
import { metaLine, entityRow, entityList, segmented, seasonPicker, seasonSlot } from "../utils/ui.js";
import { asyncSection, kvCard, formChips } from "../utils/sections.js";
import { FixtureCard, groupByDay } from "./FixtureCard.js";
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
// `ctx.season` is the season picked in the season bar (null = the league's current one).
const seasonAndEntry = (id, ctx = {}) => getLeague(id).then((entry) => ({ entry, season: ctx.season ?? getBestSeason(entry) }));
const byTime = (a, b) => (a.fixture?.timestamp || 0) - (b.fixture?.timestamp || 0);
const clubPath = (team) => "/club/" + buildSlug(team.id, team.name);
const playerPath = (player) => "/player/" + buildSlug(player.id, player.name);

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
  const ctx = { season: null };
  const seasonBar = seasonSlot();
  const page = createTabbedPage({
    title: "League",
    onBack,
    hero: seasonBar.node,
    tabs: [
      { id: "overview", label: "Overview", skeleton: "overview", load: () => loadOverview(id, ctx, (tab) => page.setTab(tab)) },
      { id: "standings", label: "Table", skeleton: "table", load: () => loadStandings(id, ctx) },
      { id: "matches", label: "Matches", skeleton: "cards", load: () => loadMatches(id, ctx) },
      { id: "players", label: "Players", skeleton: "people", load: () => loadPlayers(id, ctx) },
    ],
  });

  // Season switcher. Also the way out when the data plan doesn't cover the
  // newest season: pick an earlier one and every tab reloads for it.
  getLeague(id)
    .then((entry) => {
      const years = [...new Set((entry?.seasons || []).map((s) => s.year).filter(Number.isInteger))].sort((a, b) => b - a);
      if (years.length < 2) return seasonBar.hide();
      const current = getBestSeason(entry);
      seasonBar.show(seasonPicker({
        options: years.map((year) => ({ value: year, label: seasonLabel(entry, year) })),
        value: current,
        onChange: (value) => { ctx.season = Number(value); page.reload(); },
      }));
    })
    .catch(() => seasonBar.hide());
  return page;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
function seasonStatus(season) {
  if (!season?.start || !season?.end) return null;
  const now = Date.now(), start = new Date(season.start).getTime(), end = new Date(season.end).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (now < start) return "Not started";
  if (now > end + 86400000) return "Finished";
  return "In progress";
}

const COVERAGE_LABELS = [
  ["standings", "Table"], ["top_scorers", "Top scorers"], ["top_assists", "Top assists"], ["players", "Player stats"],
  ["predictions", "Predictions"], ["odds", "Odds"], ["injuries", "Injuries"],
];
const FIXTURE_COVERAGE = [["events", "Live events"], ["lineups", "Lineups"], ["statistics_fixtures", "Match stats"]];

function coverageChips(season) {
  const coverage = season?.coverage;
  if (!coverage) return null;
  const labels = [
    ...FIXTURE_COVERAGE.filter(([key]) => coverage.fixtures?.[key]).map(([, label]) => label),
    ...COVERAGE_LABELS.filter(([key]) => coverage[key]).map(([, label]) => label),
  ];
  return labels.length ? h("div", { className: "chip-row" }, labels.map((label) => text("span", { className: "chip" }, label))) : null;
}

function loadOverview(id, ctx, goToTab) {
  return seasonAndEntry(id, ctx).then(({ entry, season }) => {
    if (!entry) return emptyNode("League not found.");
    const { league, country } = entry;
    const seasonInfo = (entry.seasons || []).find((s) => s.year === season);

    const root = h("div", { className: "entity-page-inner" }, [
      h("section", { className: "entity-hero league-hero" }, [
        h("img", { src: league.logo, alt: league.name, className: "entity-logo" }),
        text("h1", { className: "entity-title" }, league.name),
        metaLine([country?.name || "International", league.type], "meta-line entity-meta"),
      ]),
      h("div", { className: "info-section" }, [
        kvCard([
          ["Season", seasonLabel(entry, season)],
          ["Status", seasonStatus(seasonInfo)],
          ["Starts", seasonInfo?.start ? formatDate(seasonInfo.start) : null],
          ["Ends", seasonInfo?.end ? formatDate(seasonInfo.end) : null],
          ["Type", league.type],
          ["Country", country?.name],
        ]),
      ]),
    ]);

    const chips = coverageChips(seasonInfo);

    root.append(
      asyncSection({
        title: "Top of the table",
        skeleton: "list",
        action: h("button", { type: "button", className: "text-action", onClick: () => goToTab("standings") }, "Full table"),
        load: () => getStandings(id, season),
        render: (rows) => {
          const group = (rows[0]?.league?.standings || []).find((g) => g?.length);
          if (!group) return null;
          return entityList(group.slice(0, 5).map((row) => {
            const node = entityRow({
              image: row.team.logo, title: row.team.name, subtitle: (row.all?.played ?? 0) + " played",
              trailing: text("strong", { className: "mono entity-row-value" }, row.points ?? ""),
              onClick: () => navigate(clubPath(row.team)),
            });
            node.prepend(text("span", { className: "mono entity-rank" }, row.rank));
            return node;
          }));
        },
      }),
      asyncSection({
        title: "Next matches",
        skeleton: "cards",
        action: h("button", { type: "button", className: "text-action", onClick: () => goToTab("matches") }, "All"),
        load: () => getUpcomingFixtures(id, season, 4),
        render: (fixtures) => fixtures.length ? h("div", { className: "fixture-list" }, fixtures.map((fx) => FixtureCard(fx, { showRound: true }))) : null,
      }),
      asyncSection({
        title: "Top scorers",
        skeleton: "peopleFew",
        action: h("button", { type: "button", className: "text-action", onClick: () => goToTab("players") }, "All"),
        load: () => getTopScorers(id, season),
        render: (rows) => entityList(rows.slice(0, 3).map((entry) => playerRow(entry, entry.statistics?.[0]?.goals?.total))),
      }),
      asyncSection({
        title: "Clubs",
        skeleton: "clubs",
        load: () => getLeagueTeams(id, season),
        render: (rows) => {
          const teams = rows.map((r) => r.team).filter(Boolean);
          if (!teams.length) return null;
          return h("div", { className: "club-grid" }, teams.map((team) =>
            h("button", { type: "button", className: "club-tile", onClick: () => navigate(clubPath(team)), "aria-label": team.name }, [
              h("img", { src: team.logo, alt: "", loading: "lazy" }), text("span", {}, team.name),
            ])
          ));
        },
      }),
      chips ? h("div", { className: "info-section" }, [text("h2", { className: "info-section-title chip-title" }, "Data available"), chips]) : null
    );
    return root;
  });
}

function playerRow(entry, value, extra = "") {
  const player = entry.player;
  const stat = entry.statistics?.[0];
  return entityRow({
    image: player.photo, round: true, title: player.name,
    subtitle: [stat?.team?.name, extra].filter(Boolean).join(", "),
    trailing: text("strong", { className: "mono entity-row-value" }, value ?? "\u2013"),
    onClick: () => navigate(playerPath(player)),
  });
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------
function zoneOf(description) {
  const d = String(description || "").toLowerCase();
  if (!d) return null;
  if (/relegat/.test(d)) return "rel";
  if (/champions league|promotion|libertadores|world cup|qualif.*group|next round|final/.test(d) && !/play-?off/.test(d)) return "top";
  if (/europa league|sudamericana/.test(d)) return "el";
  if (/conference/.test(d)) return "ecl";
  if (/play-?off|qualification/.test(d)) return "po";
  return "other";
}
const ZONE_LABEL = { top: "top", el: "el", ecl: "ecl", po: "po", rel: "rel", other: "other" };

function formDots(form) {
  const letters = String(form || "").toUpperCase().replace(/[^WDL]/g, "").slice(-5).split("");
  if (!letters.length) return null;
  return h("span", { className: "form-dots", "aria-label": "Form " + letters.join(" ") },
    letters.map((l) => h("i", { className: l === "W" ? "win" : l === "L" ? "loss" : "draw" })));
}

function standingsTable(table) {
  const zones = [...new Map(table.filter((r) => zoneOf(r.description)).map((r) => [r.description, zoneOf(r.description)])).entries()];
  const gd = (row) => (row.goalsDiff > 0 ? "+" + row.goalsDiff : String(row.goalsDiff ?? "\u2013"));

  const header = h("div", { className: "standings-row standings-head" }, [
    text("span", {}, "#"), text("span", {}, "Team"), text("span", { className: "st-p" }, "P"),
    text("span", { className: "st-w" }, "W"), text("span", { className: "st-d" }, "D"), text("span", { className: "st-l" }, "L"),
    text("span", { className: "st-gd" }, "GD"), text("span", { className: "st-pts" }, "Pts"),
  ]);

  const rows = table.map((row) =>
    h("button", { type: "button", className: "standings-row team zone-" + (ZONE_LABEL[zoneOf(row.description)] || "none"), onClick: () => navigate(clubPath(row.team)), "aria-label": "Open " + row.team.name }, [
      text("span", { className: "mono st-rank" }, row.rank),
      h("span", { className: "st-team" }, [
        h("img", { src: row.team.logo, alt: "", className: "standings-team-logo" }),
        h("span", { className: "st-team-copy" }, [text("strong", { className: "standings-team-name" }, row.team.name), formDots(row.form)]),
      ]),
      text("span", { className: "mono st-p" }, row.all?.played ?? "\u2013"),
      text("span", { className: "mono st-w" }, row.all?.win ?? "\u2013"),
      text("span", { className: "mono st-d" }, row.all?.draw ?? "\u2013"),
      text("span", { className: "mono st-l" }, row.all?.lose ?? "\u2013"),
      text("span", { className: "mono st-gd" }, gd(row)),
      text("strong", { className: "mono st-pts" }, row.points ?? "\u2013"),
    ])
  );

  return h("div", {}, [
    h("div", { className: "standings-table" }, [header, ...rows]),
    zones.length ? h("div", { className: "zone-legend" }, zones.map(([label, zone]) => h("span", { className: "zone-key" }, [h("i", { className: "zone-dot zone-" + zone }), text("span", {}, label)]))) : null,
  ]);
}

function loadStandings(id, ctx) {
  return seasonAndEntry(id, ctx)
    .then(({ season }) => getStandings(id, season).then((rows) => ({ season, rows })))
    .then(({ season, rows }) => {
      // Cup-style competitions (e.g. Champions League) have several groups.
      const groups = (rows[0]?.league?.standings || []).filter((g) => g?.length);
      if (!groups.length) return emptyNode("The table isn't available for the " + season + " season yet.");
      if (groups.length === 1) return standingsTable(groups[0]);
      return h("div", { className: "standings-groups" }, groups.flatMap((group) => [
        text("div", { className: "section-kicker standings-group-title" }, group[0]?.group || "Group"),
        standingsTable(group),
      ]));
    });
}

// ---------------------------------------------------------------------------
// Matches (upcoming / results)
// ---------------------------------------------------------------------------
function fixtureGroups(fixtures) {
  const nodes = [];
  groupByDay(fixtures).forEach((group) => {
    nodes.push(text("div", { className: "day-heading" }, group.label));
    group.items.forEach((fx) => nodes.push(FixtureCard(fx, { showRound: true })));
  });
  return h("div", { className: "fixture-list" }, nodes);
}

function loadMatches(id, ctx) {
  return seasonAndEntry(id, ctx).then(({ season }) => {
    const wrap = h("div", { className: "entity-page-inner" });
    const list = h("div", {});
    const cache = new Map();

    const loaders = {
      upcoming: () => getLeagueFixtures(id, season, { next: 20 }).then((rows) => [...rows].sort(byTime)),
      results: () => getLeagueFixtures(id, season, { last: 20 }).then((rows) => [...rows].sort(byTime).reverse()),
    };

    function show(which) {
      list.replaceChildren(skeletonBlock("cards"));
      const request = cache.get(which) || loaders[which]();
      cache.set(which, request);
      request
        .then((fixtures) => {
          if (list.dataset.mode !== which) return;
          list.replaceChildren(fixtures.length ? fixtureGroups(fixtures) : emptyNode(which === "upcoming" ? "No upcoming fixtures for the " + season + " season." : "No results yet for the " + season + " season."));
        })
        .catch((error) => {
          cache.delete(which);
          if (list.dataset.mode === which) list.replaceChildren(errorNode(error?.message));
        });
    }

    const control = segmented([{ id: "upcoming", label: "Upcoming" }, { id: "results", label: "Results" }], (which) => { list.dataset.mode = which; show(which); });
    list.dataset.mode = "upcoming";
    wrap.append(h("div", { className: "seg-wrap" }, [control.node]), list);
    show("upcoming");
    return wrap;
  });
}

// ---------------------------------------------------------------------------
// Players (leaders)
// ---------------------------------------------------------------------------
const LEADERS = {
  goals: { label: "Goals", load: getTopScorers, value: (s) => s?.goals?.total, extra: (s) => (s?.games?.appearences != null ? s.games.appearences + " apps" : "") },
  assists: { label: "Assists", load: getTopAssists, value: (s) => s?.goals?.assists, extra: (s) => (s?.games?.appearences != null ? s.games.appearences + " apps" : "") },
  yellow: { label: "Yellow", load: getTopYellowCards, value: (s) => s?.cards?.yellow, extra: () => "" },
  red: { label: "Red", load: getTopRedCards, value: (s) => s?.cards?.red, extra: () => "" },
};

function loadPlayers(id, ctx) {
  return seasonAndEntry(id, ctx).then(({ season }) => {
    const wrap = h("div", { className: "entity-page-inner" });
    const list = h("div", {});
    const cache = new Map();

    function show(kind) {
      const leader = LEADERS[kind];
      list.replaceChildren(skeletonBlock("people"));
      const request = cache.get(kind) || leader.load(id, season);
      cache.set(kind, request);
      request
        .then((rows) => {
          if (list.dataset.mode !== kind) return;
          const nodes = rows.slice(0, 20).map((entry, index) => {
            const stat = entry.statistics?.[0];
            const row = playerRow(entry, leader.value(stat), leader.extra(stat));
            row.prepend(text("span", { className: "mono entity-rank" }, index + 1));
            return row;
          });
          list.replaceChildren(nodes.length ? entityList(nodes) : emptyNode("No data available for this season."));
        })
        .catch((error) => {
          cache.delete(kind);
          if (list.dataset.mode === kind) list.replaceChildren(errorNode(error?.message));
        });
    }

    const control = segmented(Object.entries(LEADERS).map(([key, value]) => ({ id: key, label: value.label })), (kind) => { list.dataset.mode = kind; show(kind); });
    list.dataset.mode = "goals";
    wrap.append(h("div", { className: "seg-wrap" }, [control.node]), list);
    show("goals");
    return wrap;
  });
}
