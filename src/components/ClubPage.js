import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import {
  getTeamById, getTeamSquad, getTeamFixtures, getTeamStatistics, getTeamLeagues, getStandings, getCoach,
} from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { getBestSeason, seasonLabel, resultFor } from "../utils/fixtures.js";
import { metaLine, entityRow, entityList } from "../utils/ui.js";
import { asyncSection, sectionShell, statTiles, kvCard, formChips } from "../utils/sections.js";
import { FixtureCard, groupByDay } from "./FixtureCard.js";
import { navigate } from "../router.js";

// Team statistics need a league + season. `current=true` can list cups first,
// so prefer the domestic league entry.
function resolveContext(id) {
  return getTeamLeagues(id)
    .then((rows) => {
      const entry = rows.find((r) => r.league?.type === "League") || rows[0];
      return { leagueId: entry?.league?.id || null, season: getBestSeason(entry), entry };
    })
    .catch(() => ({ leagueId: null, season: null, entry: null }));
}

export function ClubPage({ id, onBack }) {
  const teamPromise = getTeamById(id).then((rows) => rows[0] || null);
  const contextPromise = resolveContext(id);
  return createTabbedPage({
    title: "Club",
    onBack,
    tabs: [
      { id: "overview", label: "Overview", load: () => loadOverview(id, teamPromise, contextPromise) },
      { id: "matches", label: "Matches", load: () => loadMatches(id) },
      { id: "squad", label: "Squad", load: () => loadSquad(id) },
      { id: "stats", label: "Stats", load: () => loadStats(id, contextPromise) },
    ],
  });
}

const byTime = (a, b) => (a.fixture?.timestamp || 0) - (b.fixture?.timestamp || 0);
const dash = "\u2013";
const orDash = (v) => (v == null || v === "" ? dash : v);

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
function pickCoach(rows, teamId) {
  const list = Array.isArray(rows) ? rows : [];
  // Only a manager whose spell at this club is still open; never guess.
  return list.find((c) => (c.career || []).some((step) => step.team?.id === teamId && !step.end)) || null;
}

function stadiumCard(venue) {
  if (!venue?.name) return null;
  const tiles = statTiles([["Capacity", venue.capacity ? Number(venue.capacity).toLocaleString() : null], ["Surface", venue.surface ? String(venue.surface).replace(/^./, (c) => c.toUpperCase()) : null]]);
  const props = { className: "card stadium-card" };
  const content = [
    venue.image ? h("img", { className: "stadium-image", src: venue.image, alt: "", loading: "lazy" }) : null,
    h("div", { className: "stadium-body" }, [
      text("strong", { className: "info-card-title" }, venue.name),
      metaLine([venue.city, venue.address], "meta-line"),
      tiles,
    ]),
  ];
  if (venue.id) return h("button", { ...props, type: "button", onClick: () => navigate("/venue/" + buildSlug(venue.id, venue.name)), "aria-label": "Open " + venue.name }, content);
  return h("div", props, content);
}

function recentFormNode(rows, teamId) {
  const played = rows.filter((fx) => resultFor(fx, teamId)).sort(byTime); // oldest -> newest
  if (!played.length) return null;
  const chips = formChips(played.map((fx) => resultFor(fx, teamId)).join(""), 5);
  const latest = [...played].reverse().slice(0, 3);
  return h("div", { className: "entity-page-inner" }, [
    h("div", { className: "card form-strip" }, [text("span", { className: "muted-copy" }, "Last " + played.length + " results, oldest to latest"), chips]),
    h("div", { className: "fixture-list" }, latest.map((fx) => FixtureCard(fx, { teamId }))),
  ]);
}

function positionNode(data, teamId) {
  if (!data) return null;
  const row = (data.rows[0]?.league?.standings || []).flat().find((r) => r?.team?.id === teamId);
  if (!row) return null;
  const league = data.ctx.entry?.league;
  const gd = row.goalsDiff > 0 ? "+" + row.goalsDiff : row.goalsDiff;
  return h("div", { className: "entity-page-inner" }, [
    statTiles([["Position", "#" + row.rank], ["Points", row.points], ["Played", row.all?.played], ["Goal diff", gd]]),
    h("div", { className: "card form-strip" }, [
      text("span", { className: "muted-copy" }, "W " + orDash(row.all?.win) + "  D " + orDash(row.all?.draw) + "  L " + orDash(row.all?.lose)),
      formChips(row.form, 5),
    ]),
    league ? entityList([entityRow({
      image: league.logo, title: league.name, subtitle: "Season " + seasonLabel(data.ctx.entry, data.ctx.season),
      onClick: () => navigate("/league/" + buildSlug(league.id, league.name)),
    })]) : null,
  ]);
}

function loadOverview(id, teamPromise, contextPromise) {
  return teamPromise.then((entry) => {
    if (!entry) return emptyNode("Club not found.");
    const { team, venue } = entry;

    const root = h("div", { className: "entity-page-inner" }, [
      h("section", { className: "entity-hero" }, [
        h("img", { className: "entity-logo", src: team.logo, alt: team.name }),
        text("h1", { className: "entity-title" }, team.name),
        metaLine([team.country, team.founded ? "Founded " + team.founded : null], "meta-line entity-meta"),
      ]),
    ]);

    root.append(
      asyncSection({
        title: "Next match",
        load: () => getTeamFixtures(id, { next: 1 }),
        render: (rows) => (rows[0] ? FixtureCard(rows[0], { teamId: id, showLeague: true }) : null),
      }),
      asyncSection({ title: "Recent form", load: () => getTeamFixtures(id, { last: 5 }), render: (rows) => recentFormNode(rows, id) }),
      asyncSection({
        title: "League position",
        load: () => contextPromise.then((ctx) => (ctx.leagueId ? getStandings(ctx.leagueId, ctx.season, id).then((rows) => ({ rows, ctx })) : null)),
        render: (data) => positionNode(data, id),
      }),
      asyncSection({
        title: "Manager",
        load: () => getCoach(id),
        render: (rows) => {
          const coach = pickCoach(rows, id);
          if (!coach?.name) return null;
          return entityList([entityRow({
            image: coach.photo, round: true, title: coach.name,
            subtitle: [coach.nationality, coach.age ? coach.age + " years" : null].filter(Boolean).join(", "),
          })]);
        },
      })
    );

    const stadium = stadiumCard(venue);
    if (stadium) {
      const { root: section, body } = sectionShell("Stadium");
      body.appendChild(stadium);
      root.appendChild(section);
    }

    const facts = kvCard([
      ["Country", team.country], ["Founded", team.founded], ["Club code", team.code], ["Type", team.national ? "National team" : "Club"],
    ]);
    if (facts) {
      const { root: section, body } = sectionShell("Club facts");
      body.appendChild(facts);
      root.appendChild(section);
    }
    return root;
  });
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------
function matchList(fixtures, teamId) {
  const nodes = [];
  groupByDay(fixtures).forEach((group) => {
    nodes.push(text("div", { className: "day-heading" }, group.label));
    group.items.forEach((fx) => nodes.push(FixtureCard(fx, { teamId, showLeague: true })));
  });
  return h("div", { className: "fixture-list" }, nodes);
}

// `last` and `next` cannot be combined in one API call, so fetch both.
function loadMatches(id) {
  return Promise.allSettled([getTeamFixtures(id, { next: 10 }), getTeamFixtures(id, { last: 10 })]).then(([upcoming, recent]) => {
    if (upcoming.status === "rejected" && recent.status === "rejected") throw upcoming.reason;
    const next = upcoming.status === "fulfilled" ? [...upcoming.value].sort(byTime) : [];
    const last = recent.status === "fulfilled" ? [...recent.value].sort(byTime).reverse() : [];
    if (!next.length && !last.length) return emptyNode("No recent or upcoming fixtures are available.");

    const root = h("div", { className: "entity-page-inner" });
    if (next.length) { const { root: s, body } = sectionShell("Upcoming"); body.appendChild(matchList(next, id)); root.appendChild(s); }
    if (last.length) { const { root: s, body } = sectionShell("Results"); body.appendChild(matchList(last, id)); root.appendChild(s); }
    return root;
  });
}

// ---------------------------------------------------------------------------
// Squad
// ---------------------------------------------------------------------------
const POSITION_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Attacker"];
const POSITION_LABEL = { Goalkeeper: "Goalkeepers", Defender: "Defenders", Midfielder: "Midfielders", Attacker: "Attackers" };

// players/squads returns [{ team, players: [...] }] — one object holding the
// whole squad — with `position` and `number` directly on each player.
function loadSquad(id) {
  return getTeamSquad(id).then((rows) => {
    const players = rows[0]?.players || [];
    if (!players.length) return emptyNode("Squad data is not available for this team.");

    const ages = players.map((p) => p.age).filter((a) => Number.isFinite(a));
    const average = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : null;

    const byPosition = new Map();
    for (const p of players) {
      const key = p.position || "Other";
      if (!byPosition.has(key)) byPosition.set(key, []);
      byPosition.get(key).push(p);
    }
    const order = [...byPosition.keys()].sort((a, b) => {
      const ia = POSITION_ORDER.indexOf(a), ib = POSITION_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const root = h("div", { className: "entity-page-inner" }, [statTiles([["Players", players.length], ["Average age", average]])]);
    order.forEach((position) => {
      const { root: section, body } = sectionShell(POSITION_LABEL[position] || position);
      const list = [...byPosition.get(position)].sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
      body.appendChild(entityList(list.map((p) => entityRow({
        image: p.photo, round: true, title: p.name, subtitle: p.age ? p.age + " years" : "",
        trailing: p.number != null ? text("span", { className: "mono entity-row-value muted" }, "#" + p.number) : null,
        onClick: () => navigate("/player/" + buildSlug(p.id, p.name)),
      }))));
      root.appendChild(section);
    });
    return root;
  });
}

// ---------------------------------------------------------------------------
// Stats (teams/statistics returns one object, or [] when there is no data)
// ---------------------------------------------------------------------------
function miniTable(head, rows) {
  const cells = (values, cls) => h("div", { className: "mini-row " + cls }, values.map((v, i) => text("span", { className: i === 0 ? "mini-label" : "mono" }, orDash(v))));
  return h("div", { className: "card mini-table" }, [cells(head, "head"), ...rows.map((r) => cells(r, ""))]);
}

const has = (v) => v && typeof v === "object" && Object.values(v).some((x) => x != null && x !== "");

function recordSection(s) {
  const f = s.fixtures;
  if (!has(f?.played)) return null;
  const row = (label, o) => [label, o?.home, o?.away, o?.total];
  return miniTable(["", "Home", "Away", "Total"], [row("Played", f.played), row("Wins", f.wins), row("Draws", f.draws), row("Losses", f.loses)]);
}

const MINUTE_KEYS = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90", "91-105", "106-120"];

function minuteChart(label, minutes) {
  if (!minutes) return null;
  const keys = MINUTE_KEYS.filter((k, i) => i < 6 || (minutes[k]?.total ?? 0) > 0);
  const totals = keys.map((k) => Number(minutes[k]?.total) || 0);
  const max = Math.max(...totals, 0);
  if (max === 0) return null;
  return h("div", { className: "card minute-chart" }, [
    text("span", { className: "section-kicker" }, label),
    h("div", { className: "minute-bars" }, keys.map((key, i) => h("div", { className: "minute-col" }, [
      text("span", { className: "mono minute-value" }, totals[i]),
      h("span", { className: "minute-bar", style: { height: Math.max(4, (totals[i] / max) * 72) + "px" } }),
      text("span", { className: "minute-label" }, key),
    ]))),
  ]);
}

function goalsSection(s) {
  const g = s.goals;
  const scored = g?.for?.total?.total, conceded = g?.against?.total?.total;
  const tiles = statTiles([["Scored", scored], ["Conceded", conceded], ["Scored per game", g?.for?.average?.total], ["Conceded per game", g?.against?.average?.total]]);
  const nodes = [tiles, minuteChart("Goals scored by minute", g?.for?.minute), minuteChart("Goals conceded by minute", g?.against?.minute)].filter(Boolean);
  return nodes.length ? h("div", { className: "entity-page-inner" }, nodes) : null;
}

function sheetsSection(s) {
  const clean = s.clean_sheet, failed = s.failed_to_score;
  const rows = [];
  if (has(clean)) rows.push(["Clean sheets", clean.home, clean.away, clean.total]);
  if (has(failed)) rows.push(["Failed to score", failed.home, failed.away, failed.total]);
  return rows.length ? miniTable(["", "Home", "Away", "Total"], rows) : null;
}

function biggestSection(s) {
  const b = s.biggest;
  if (!b) return null;
  return kvCard([
    ["Longest winning run", b.streak?.wins], ["Longest unbeaten draws", b.streak?.draws], ["Longest losing run", b.streak?.loses],
    ["Biggest home win", b.wins?.home], ["Biggest away win", b.wins?.away],
    ["Heaviest home defeat", b.loses?.home], ["Heaviest away defeat", b.loses?.away],
  ]);
}

function formationsSection(s) {
  const list = (s.lineups || []).filter((l) => l?.formation && l.played > 0).sort((a, b) => b.played - a.played).slice(0, 6);
  if (!list.length) return null;
  const max = list[0].played;
  return h("div", { className: "card formation-card" }, list.map((l) =>
    h("div", { className: "formation-row" }, [
      text("span", { className: "mono formation-name" }, l.formation),
      h("span", { className: "formation-track" }, [h("span", { style: { width: (l.played / max) * 100 + "%" } })]),
      text("span", { className: "mono formation-count" }, l.played),
    ])
  ));
}

function sumMinutes(obj) {
  return obj ? Object.values(obj).reduce((total, m) => total + (Number(m?.total) || 0), 0) : null;
}

function disciplineSection(s) {
  const tiles = statTiles([["Yellow cards", sumMinutes(s.cards?.yellow)], ["Red cards", sumMinutes(s.cards?.red)], ["Penalties scored", s.penalty?.scored?.total], ["Penalties missed", s.penalty?.missed?.total]]);
  return tiles;
}

function loadStats(id, contextPromise) {
  return contextPromise
    .then(({ leagueId, season }) => (leagueId ? getTeamStatistics(id, leagueId, season) : null))
    .then((data) => {
      if (data === null) return emptyNode("Team statistics need a league, and none was found for this club.");
      const s = Array.isArray(data) ? data[0] : data;
      if (!s || !s.fixtures) return emptyNode("Team statistics are not available for this season.");

      const root = h("div", { className: "entity-page-inner" });
      const add = (title, node) => {
        if (!node) return;
        const { root: section, body } = sectionShell(title);
        body.appendChild(node);
        root.appendChild(section);
      };
      const form = formChips(s.form, 10);
      add("Form", form ? h("div", { className: "card form-strip" }, [text("span", { className: "muted-copy" }, "Last results, oldest to latest"), form]) : null);
      add("Record", recordSection(s));
      add("Goals", goalsSection(s));
      add("Clean sheets and scoring", sheetsSection(s));
      add("Biggest results", biggestSection(s));
      add("Formations used", formationsSection(s));
      add("Cards and penalties", disciplineSection(s));
      return root.children.length ? root : emptyNode("Team statistics are not available for this season.");
    });
}
