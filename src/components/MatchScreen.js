import { h, text } from "../utils/h.js";
import { OddsTable } from "./OddsTable.js";
import { PredictionsPanel } from "./PredictionsPanel.js";
import { getFixtureById, getPrediction, getHeadToHead, getFixtureEvents, getFixtureLineups, getFixtureStatistics } from "../api/footballApi.js";
import { createTabbedPage, emptyNode, skeletonBlock } from "../utils/tabbedPage.js";

const TABS = ["summary", "events", "lineups", "stats", "prediction"];

export function MatchScreen({
  match,
  fixtureId,
  matchTab = "summary",
  isVip,
  coins,
  isFavorite,
  onBack,
  onTabChange,
  onRequestUpgrade,
  onUnlockWithCoins,
  onToggleFavorite,
}) {
  if (fixtureId) {
    return RealMatchPage({
      fixtureId,
      defaultTab: TABS.includes(matchTab) ? matchTab : "summary",
      onBack,
      isFavorite,
      onToggleFavorite,
    });
  }

  return LegacyMatchPage({
    match,
    matchTab,
    isVip,
    coins,
    isFavorite,
    onBack,
    onTabChange,
    onRequestUpgrade,
    onUnlockWithCoins,
    onToggleFavorite,
  });
}

function LegacyMatchPage(props) {
  const { match, matchTab, isFavorite, onBack, onTabChange, onRequestUpgrade, onUnlockWithCoins, coins, isVip } = props;
  if (!match) {
    return h("main", { className: "screen match-screen match-missing" }, [
      h("div", { className: "card match-missing-card" }, [
        h("i", { "data-lucide": "circle-alert" }),
        text("strong", {}, "Match unavailable"),
        text("span", {}, "This match could not be loaded."),
        h("button", { className: "primary-button", onClick: onBack }, "Go back"),
      ]),
    ]);
  }

  const active = ["summary", "predictions", "odds", "lineup", "standings"].includes(matchTab) ? matchTab : "summary";
  return h("main", { className: "screen match-screen" }, [
    matchHeader(onBack, isFavorite, onToggleFavorite, "Match"),
    scoreboard({
      league: match.league,
      status: match.status === "live" ? match.minute + "' LIVE" : match.time === "FT" ? "FULL TIME" : "KICKOFF " + match.time,
      home: match.home,
      away: match.away,
      homeScore: match.scoreH,
      awayScore: match.scoreA,
      live: match.status === "live",
    }),
    h("nav", { className: "match-tabs", "aria-label": "Match sections" },
      ["summary", "predictions", "odds", "lineup", "standings"].map((tab) =>
        h("button", { className: "match-tab " + (active === tab ? "active" : ""), onClick: () => onTabChange(tab) },
          tab === "odds" ? "Odds" : tab.charAt(0).toUpperCase() + tab.slice(1)
        )
      )
    ),
    legacyPanel(active, match, { isVip, coins, onRequestUpgrade, onUnlockWithCoins }),
  ]);
}

function RealMatchPage({ fixtureId, defaultTab, onBack, isFavorite, onToggleFavorite }) {
  const fixturePromise = getFixtureById(fixtureId).then((rows) => rows[0] || null);

  return createTabbedPage({
    title: "Match",
    onBack,
    defaultTab,
    tabs: TABS.map((id) => ({
      id,
      label: id === "prediction" ? "Prediction" : id.charAt(0).toUpperCase() + id.slice(1),
      load: () => fixturePromise.then((fixture) => loadRealTab(id, fixture)),
    })),
    beforeTabs: null,
  });
}

function loadRealTab(tab, fixture) {
  if (!fixture) return emptyNode("This match is no longer available from the football data provider.");

  if (tab === "prediction") {
    return getPrediction(fixture.fixture.id)
      .then((rows) => renderPrediction(fixture, rows[0] || null));
  }

  if (tab === "events") {
    return getFixtureEvents(fixture.fixture.id).then((rows) => renderEvents(rows)).catch(() => emptyNode("Match events are unavailable right now."));
  }
  if (tab === "lineups") {
    return getFixtureLineups(fixture.fixture.id).then((rows) => renderLineups(rows)).catch(() => emptyNode("Lineups are unavailable right now."));
  }
  if (tab === "stats") {
    return getFixtureStatistics(fixture.fixture.id).then((rows) => renderStats(rows)).catch(() => emptyNode("Match statistics are unavailable right now."));
  }
  return renderRealSummary(fixture);
}

function renderRealSummary(fixture) {
  const fixtureInfo = fixture.fixture || {};
  const league = fixture.league || {};
  const teams = fixture.teams || {};
  const goals = fixture.goals || {};
  const score = fixture.score || {};
  const home = teams.home || {};
  const away = teams.away || {};
  const status = fixtureInfo.status || {};

  const detailRows = [
    infoRow("Competition", league.name),
    infoRow("Round", league.round),
    infoRow("Venue", fixtureInfo.venue?.name),
    infoRow("Referee", fixtureInfo.referee),
    infoRow("Kickoff", formatDate(fixtureInfo.date)),
    infoRow("Half-time", score.halftime?.home != null ? score.halftime.home + " – " + score.halftime.away : null),
  ].filter(Boolean);

  const teamsReady = home.id && away.id;
  const h2hPromise = teamsReady
    ? getHeadToHead(home.id, away.id, 5).catch(() => [])
    : Promise.resolve([]);

  const root = h("section", { className: "match-panel real-match-panel" }, [
    h("div", { className: "card match-summary-card" }, [
      text("span", { className: "section-kicker" }, "MATCH STATUS"),
      text("strong", { className: "match-summary-status" }, status.long || status.short || "Scheduled"),
      detailRows.length ? h("div", { className: "match-info-grid" }, detailRows) : null,
    ]),
    h("div", { className: "card match-summary-card" }, [
      text("span", { className: "section-kicker" }, "HEAD TO HEAD"),
      h("div", { className: "h2h-loading" }, skeletonBlock()),
    ]),
  ]);

  h2hPromise.then((rows) => {
    const card = root.querySelector(".h2h-loading");
    if (!card) return;
    card.innerHTML = "";
    card.appendChild(renderH2H(rows, home.id, away.id));
  });

  return withMatchScoreboard(root, fixture, onBack, isFavorite, onToggleFavorite);
}

function renderH2H(rows, homeId, awayId) {
  if (!rows.length) return text("div", { className: "muted-copy" }, "Head-to-head history is unavailable.");
  const recent = rows.slice(0, 5);
  const homeWins = recent.filter((r) => winnerOf(r, homeId) === "home").length;
  const awayWins = recent.filter((r) => winnerOf(r, awayId) === "home").length;
  const draws = recent.filter((r) => r.goals?.home != null && r.goals.home === r.goals.away).length;

  return h("div", { className: "h2h-block" }, [
    h("div", { className: "h2h-summary" }, [
      statPill("Home wins", homeWins),
      statPill("Draws", draws),
      statPill("Away wins", awayWins),
    ]),
    ...recent.map((r) => {
      const d = formatDate(r.fixture?.date, true);
      return h("div", { className: "h2h-row" }, [
        text("span", { className: "muted-copy" }, d),
        text("strong", {}, (r.teams?.home?.name || "Home") + " " + (r.goals?.home ?? "—") + "–" + (r.goals?.away ?? "—") + " " + (r.teams?.away?.name || "Away")),
      ]);
    }),
  ]);
}

function winnerOf(fixture, teamId) {
  if (fixture.teams?.home?.id !== teamId) return fixture.teams?.away?.winner ? "home" : null;
  return fixture.teams?.home?.winner ? "home" : null;
}

function renderEvents(rows) {
  const events = Array.isArray(rows) ? rows : [];
  if (!events.length) return emptyNode("No match events are available yet.");
  return h("section", { className: "match-events" }, events.map((event) => {
    const type = event.type || "";
    const detail = event.detail || "";
    const icon = type.toLowerCase().includes("card") ? "▣" : type.toLowerCase().includes("subst") ? "⇄" : "⚽";
    const player = event.player?.name || "Unknown player";
    const assist = event.assist?.name ? " · " + event.assist.name : "";
    const side = event.team?.name || "";
    return h("article", { className: "match-event-row" }, [
      text("span", { className: "match-event-minute mono" }, (event.time?.elapsed ?? "—") + (event.time?.extra ? "+" + event.time.extra : "") + "'"),
      text("span", { className: "match-event-icon" }, icon),
      h("div", { className: "match-event-copy" }, [
        text("strong", {}, player),
        text("span", { className: "muted-copy" }, type + (detail ? " · " + detail : "") + (assist ? assist : "")),
      ]),
      text("span", { className: "match-event-team muted-copy" }, side),
    ]);
  }));
}

function renderLineups(lineups) {
  const items = Array.isArray(lineups) ? lineups : [];
  if (!items.length) return emptyNode("Lineups are not available for this match yet.");
  return h("section", { className: "match-lineups" }, items.map((entry) => {
    const startXI = (entry.startXI || []).map((item) => item.player || item);
    const subs = (entry.substitutes || []).map((item) => item.player || item);
    return h("article", { className: "card lineup-card" }, [
      h("div", { className: "lineup-team-head" }, [
        text("strong", {}, entry.team?.name || "Team"),
        text("span", { className: "mono" }, entry.formation || ""),
      ]),
      text("div", { className: "section-kicker" }, "STARTING XI"),
      ...startXI.map((p) => lineupRow(p)),
      subs.length ? text("div", { className: "section-kicker lineup-sub-title" }, "SUBSTITUTES") : null,
      ...subs.slice(0, 9).map((p) => lineupRow(p)),
    ]);
  }));
}

function lineupRow(player) {
  return h("div", { className: "lineup-api-row" }, [
    text("span", { className: "mono lineup-api-number" }, player.number ?? "—"),
    text("strong", { className: "lineup-name" }, player.name || "Unknown"),
    text("span", { className: "muted-copy" }, player.pos || ""),
  ]);
}

function renderStats(rows) {
  const stats = Array.isArray(rows) ? rows : [];
  if (!stats.length) return emptyNode("Detailed match statistics are not available yet.");
  return h("section", { className: "match-stats" }, stats.map((entry) => {
    const values = new Map((entry.statistics || []).map((s) => [s.type, s.value]));
    return h("article", { className: "card match-stat-card" }, [
      h("div", { className: "lineup-team-head" }, [text("strong", {}, entry.team?.name || "Team")]),
      ...["Ball possession", "Total shots", "Shots on goal", "Shots off goal", "Corner Kicks", "Fouls", "Offsides", "Yellow cards"].map((label) => {
        const value = values.get(label);
        return value != null ? h("div", { className: "match-stat-row" }, [
          text("span", {}, label),
          text("strong", { className: "mono" }, String(value)),
        ]) : null;
      }),
    ]);
  }));
}

function renderPrediction(fixture, prediction) {
  const p = prediction?.predictions;
  if (!p) return emptyNode("Prediction data is not available for this fixture.");
  const percent = p.percent || {};
  const winner = p.winner?.name || "No winner signal";
  return h("section", { className: "prediction-panel real-prediction-panel" }, [
    h("div", { className: "card prediction-card" }, [
      text("span", { className: "section-kicker" }, "API-FOOTBALL PREDICTION"),
      h("div", { className: "prediction-result" }, [
        text("strong", {}, winner),
        p.winner?.comment ? text("span", { className: "muted-copy" }, p.winner.comment) : null,
      ]),
      p.advice ? text("div", { className: "prediction-advice" }, p.advice) : null,
    ]),
    h("div", { className: "card prediction-card" }, [
      text("div", { className: "section-kicker" }, "WIN PROBABILITY"),
      h("div", { className: "vote-grid" }, [
        vote("HOME", percent.home),
        vote("DRAW", percent.draw),
        vote("AWAY", percent.away),
      ]),
    ]),
    p.under_over ? h("div", { className: "card prediction-card" }, [
      text("div", { className: "section-kicker" }, "GOALS"),
      text("strong", { className: "prediction-advice" }, p.under_over),
    ]) : null,
  ]);
}

function matchHeader(onBack, isFavorite, onToggleFavorite, title) {
  return h("header", { className: "match-header" }, [
    h("button", { className: "match-header-button", "aria-label": "Back", onClick: onBack }, [h("i", { "data-lucide": "arrow-left" })]),
    text("strong", { className: "match-brand-title" }, title),
    h("button", { className: "match-header-button", "aria-label": isFavorite ? "Remove from favorites" : "Add to favorites", onClick: onToggleFavorite }, [
      h("i", { "data-lucide": "star", fill: isFavorite ? "currentColor" : "none" }),
    ]),
  ]);
}

function scoreboard({ league, status, home, away, homeScore, awayScore, live }) {
  return h("section", { className: "match-hero" }, [
    league ? text("span", { className: "match-league" }, league) : null,
    h("span", { className: live ? "match-live-label" : "match-status" }, live ? [h("span", { className: "live-dot" }), text("span", {}, status)] : status),
    h("div", { className: "match-scoreboard" }, [
      h("div", { className: "match-side" }, [text("strong", {}, home || "Home")]),
      text("div", { className: "match-score-big mono" }, (homeScore ?? "—") + " – " + (awayScore ?? "—")),
      h("div", { className: "match-side away-side" }, [text("strong", {}, away || "Away")]),
    ]),
  ]);
}

function withMatchScoreboard(body, fixture, onBack, isFavorite, onToggleFavorite) {
  const teams = fixture.teams || {};
  const goals = fixture.goals || {};
  const status = fixture.fixture?.status || {};
  const score = fixture.score?.fulltime || {};
  const live = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(status.short);
  const shell = h("main", { className: "screen match-screen" }, [
    matchHeader(onBack, isFavorite, onToggleFavorite, "Match"),
    scoreboard({
      league: fixture.league?.name,
      status: live ? (status.elapsed ?? "") + "' LIVE" : status.long || status.short || "Scheduled",
      home: teams.home?.name,
      away: teams.away?.name,
      homeScore: goals.home ?? score.home,
      awayScore: goals.away ?? score.away,
      live,
    }),
    body,
  ]);
  return shell;
}

function legacyPanel(tab, match, props) {
  if (tab === "predictions") return PredictionsPanel({ match, isUnlocked: props.isVip, coins: props.coins, onRequestUpgrade: props.onRequestUpgrade, onUnlockWithCoins: props.onUnlockWithCoins });
  if (tab === "odds") return OddsTable({ match });
  if (tab === "lineup") return lineupPanel(match);
  if (tab === "standings") return standingsPanel(match);
  return h("section", { className: "match-panel" }, [
    h("div", { className: "match-panel-block card" }, [
      text("span", { className: "section-kicker" }, "HEAD TO HEAD"),
      text("p", { className: "match-copy" }, match.h2h || "Head-to-head data is unavailable."),
    ]),
    h("div", { className: "match-panel-block card" }, [
      text("span", { className: "section-kicker" }, "RECENT FORM"),
      formRow(match.home, match.form?.home || []),
      formRow(match.away, match.form?.away || []),
    ]),
  ]);
}
function formRow(team, form) { return h("div", { className: "form-row" }, [text("strong", {}, team), h("div", { className: "form-badges" }, form.length ? form.map((v) => h("span", { className: "form-badge form-" + String(v).toLowerCase() }, v)) : text("span", { className: "muted-copy" }, "No form data"))]); }
function playerRow(p) { return h("div", { className: "lineup-row" }, [text("span", { className: "lineup-number mono" }, p.no), text("strong", { className: "lineup-name" }, p.name), text("span", { className: "lineup-pos" }, p.pos)]); }
function lineupTeam(name, formation, players) { return h("div", { className: "lineup-team card" }, [h("div", { className: "lineup-team-head" }, [text("strong", {}, name), text("span", { className: "mono" }, formation)]), ...players.map(playerRow)]); }
function lineupPanel(match) { return h("section", { className: "match-panel" }, [lineupTeam(match.home, match.lineup.formation.home, match.lineup.home), lineupTeam(match.away, match.lineup.formation.away, match.lineup.away)]); }
function standingsPanel(match) { return h("section", { className: "match-panel" }, [text("h2", { className: "panel-title" }, match.standings.leagueName), h("div", { className: "standings-table" }, [h("div", { className: "standings-row standings-head" }, [text("span", {}, "#"), text("span", {}, "Team"), text("span", {}, "P"), text("span", {}, "Pts")]), ...match.standings.rows.map((row) => h("div", { className: "standings-row " + (match.standings.highlight.includes(row.team) ? "highlight" : "") }, [text("span", { className: "mono" }, row.pos), text("strong", {}, row.team), text("span", { className: "mono" }, row.played), text("strong", { className: "mono" }, row.points)]))] )]); }
function infoRow(label, value) { return value != null && value !== "" ? h("div", { className: "match-info-row" }, [text("span", {}, label), text("strong", {}, value)]) : null; }
function statPill(label, value) { return h("div", { className: "h2h-pill" }, [text("span", {}, label), text("strong", { className: "mono" }, value)]); }
function formatDate(value, short = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return short
    ? date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : date.toLocaleString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function vote(label, pct) {
  const value = pct == null ? "—" : String(pct).replace("%", "") + "%";
  const width = Number.parseFloat(String(pct ?? "").replace("%", ""));
  return h("div", { className: "vote-cell" }, [
    text("span", {}, label),
    text("strong", { className: "mono" }, value),
    h("div", { className: "vote-track" }, [h("span", { style: { width: Number.isFinite(width) ? Math.max(0, Math.min(100, width)) + "%" : "0%" } })]),
  ]);
}
