import { h, text } from "../utils/h.js";
import { OddsTable } from "./OddsTable.js";
import { Skeleton } from "./Skeleton.js";
import {
  getFixtureById, getPrediction, getHeadToHead, getFixtureEvents,
  getFixtureLineups, getFixtureStatistics, getFixtureOdds, oddsRows,
} from "../api/footballApi.js";
import { createTabbedPage, emptyNode, skeletonBlock } from "../utils/tabbedPage.js";
import { isLive, statusHeadline } from "../utils/fixtures.js";
import { metaLine, setStarState } from "../utils/ui.js";
import { navigate } from "../router.js";

const TABS = [
  ["summary", "Summary"],
  ["events", "Events"],
  ["lineups", "Lineups"],
  ["stats", "Stats"],
  ["odds", "Odds"],
  ["prediction", "Prediction"],
];

export function MatchScreen({ fixtureId, matchTab = "summary", isFavorite, onBack, onToggleFavorite, onTabChange }) {
  const fixturePromise = getFixtureById(fixtureId).then((rows) => rows[0] || null);

  const hero = h("section", { className: "match-hero" }, [
    Skeleton({ style: { width: "40%", height: "12px", margin: "0 auto 14px", borderRadius: "4px" } }),
    Skeleton({ style: { width: "100%", height: "64px", borderRadius: "12px" } }),
  ]);

  const star = h("button", {
    type: "button",
    className: "icon-button match-star" + (isFavorite ? " selected" : ""),
    "aria-label": isFavorite ? "Remove favourite" : "Add favourite",
    "aria-pressed": !!isFavorite,
    onClick: () => setStarState(star, onToggleFavorite()),
  }, [h("i", { "data-lucide": "star", fill: isFavorite ? "currentColor" : "none" })]);

  fixturePromise
    .then((fixture) => {
      hero.innerHTML = "";
      if (!fixture) {
        hero.appendChild(text("div", { className: "muted-copy" }, "This match is no longer available."));
        return;
      }
      hero.appendChild(scoreboard(fixture));
    })
    .catch((error) => {
      hero.innerHTML = "";
      hero.appendChild(text("div", { className: "async-error-state" }, error?.message || "Couldn't load this match."));
    });

  return createTabbedPage({
    title: "Match",
    onBack,
    action: star,
    hero,
    defaultTab: matchTab,
    onTabChange,
    tabs: TABS.map(([id, label]) => ({
      id,
      label,
      load: () => fixturePromise.then((fixture) => loadTab(id, fixture)),
    })),
  });
}

function loadTab(tab, fixture) {
  if (!fixture) return emptyNode("This match is no longer available from the football data provider.");
  const id = fixture.fixture.id;

  if (tab === "events") return getFixtureEvents(id).then(renderEvents);
  if (tab === "lineups") return getFixtureLineups(id).then(renderLineups);
  if (tab === "stats") return getFixtureStatistics(id).then(renderStats);
  if (tab === "odds") return getFixtureOdds(id).then((payload) => OddsTable({ match: { odds: oddsRows(payload) } }));
  if (tab === "prediction") return getPrediction(id).then((rows) => renderPrediction(rows[0] || null));
  return Promise.resolve(renderSummary(fixture));
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function teamBlock(team, away) {
  const inner = [
    team?.logo ? h("img", { className: "match-team-logo", src: team.logo, alt: "" }) : null,
    text("strong", {}, team?.name || "TBD"),
  ];
  const props = { type: "button", className: "match-side" + (away ? " away-side" : "") };
  if (team?.id) return h("button", { ...props, onClick: () => navigate("/club/" + team.id), "aria-label": "Open " + team.name }, inner);
  return h("div", props, inner);
}

function scoreboard(fx) {
  const live = isLive(fx.fixture?.status?.short);
  const goals = fx.goals || {};
  const headline = statusHeadline(fx);
  return h("div", {}, [
    metaLine([fx.league?.name, fx.league?.round], "meta-line match-league-line"),
    h("span", { className: live ? "match-live-label" : "match-status" },
      live ? [h("span", { className: "live-dot" }), text("span", {}, headline)] : headline),
    h("div", { className: "match-scoreboard" }, [
      teamBlock(fx.teams?.home, false),
      text("div", { className: "match-score-big mono" }, (goals.home ?? "\u2013") + " \u2013 " + (goals.away ?? "\u2013")),
      teamBlock(fx.teams?.away, true),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// Summary + head to head
// ---------------------------------------------------------------------------
function formatDate(value, short = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return short
    ? date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : date.toLocaleString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function infoRow(label, value) {
  return value != null && value !== ""
    ? h("div", { className: "match-info-row" }, [text("span", {}, label), text("strong", {}, value)])
    : null;
}

function renderSummary(fx) {
  const fixtureInfo = fx.fixture || {};
  const league = fx.league || {};
  const score = fx.score || {};
  const home = fx.teams?.home || {};
  const away = fx.teams?.away || {};
  const status = fixtureInfo.status || {};

  const detailRows = [
    infoRow("Competition", league.name),
    infoRow("Round", league.round),
    infoRow("Venue", [fixtureInfo.venue?.name, fixtureInfo.venue?.city].filter(Boolean).join(", ")),
    infoRow("Referee", fixtureInfo.referee),
    infoRow("Kick-off", formatDate(fixtureInfo.date)),
    infoRow("Half-time", score.halftime?.home != null ? score.halftime.home + " \u2013 " + score.halftime.away : null),
  ].filter(Boolean);

  const h2hSlot = h("div", { className: "h2h-loading" }, skeletonBlock());
  const root = h("section", { className: "match-panel real-match-panel" }, [
    h("div", { className: "card match-summary-card" }, [
      text("span", { className: "section-kicker" }, "Match status"),
      text("strong", { className: "match-summary-status" }, status.long || status.short || "Scheduled"),
      detailRows.length ? h("div", { className: "match-info-grid" }, detailRows) : null,
    ]),
    h("div", { className: "card match-summary-card" }, [
      text("span", { className: "section-kicker" }, "Head to head"),
      h2hSlot,
    ]),
  ]);

  const h2hPromise = home.id && away.id ? getHeadToHead(home.id, away.id, 5).catch(() => []) : Promise.resolve([]);
  h2hPromise.then((rows) => {
    h2hSlot.innerHTML = "";
    h2hSlot.appendChild(renderH2H(rows, home, away));
  });

  return root;
}

function statPill(label, value) {
  return h("div", { className: "h2h-pill" }, [text("span", {}, label), text("strong", { className: "mono" }, value)]);
}

function renderH2H(rows, home, away) {
  const recent = (Array.isArray(rows) ? rows : []).slice(0, 5);
  if (!recent.length) return text("div", { className: "muted-copy" }, "No previous meetings found.");

  const winsFor = (team) =>
    recent.filter((r) => (r.teams?.home?.id === team.id && r.teams.home.winner) || (r.teams?.away?.id === team.id && r.teams.away.winner)).length;
  const draws = recent.filter((r) => r.goals?.home != null && r.goals.home === r.goals.away).length;

  return h("div", { className: "h2h-block" }, [
    h("div", { className: "h2h-summary" }, [
      statPill((home.name || "Home") + " wins", winsFor(home)),
      statPill("Draws", draws),
      statPill((away.name || "Away") + " wins", winsFor(away)),
    ]),
    ...recent.map((r) =>
      h("div", { className: "h2h-row" }, [
        text("span", { className: "muted-copy" }, formatDate(r.fixture?.date, true)),
        text("strong", {}, (r.teams?.home?.name || "Home") + " " + (r.goals?.home ?? "\u2013") + "\u2013" + (r.goals?.away ?? "\u2013") + " " + (r.teams?.away?.name || "Away")),
      ])
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function eventBadge(event) {
  const type = String(event.type || "").toLowerCase();
  const detail = String(event.detail || "").toLowerCase();
  if (type === "goal") return h("span", { className: "event-badge ev-goal" }, "Goal");
  if (type === "card") return h("span", { className: "event-badge ev-card " + (detail.includes("red") ? "ev-red" : "ev-yellow"), "aria-label": event.detail }, "");
  if (type === "subst") return h("span", { className: "event-badge ev-sub" }, "Sub");
  if (type === "var") return h("span", { className: "event-badge ev-var" }, "VAR");
  return h("span", { className: "event-badge" }, event.type || "");
}

function renderEvents(rows) {
  const events = Array.isArray(rows) ? rows : [];
  if (!events.length) return emptyNode("No match events are available yet.");
  return h("section", { className: "match-events" }, events.map((event) => {
    const minute = (event.time?.elapsed ?? "\u2013") + (event.time?.extra ? "+" + event.time.extra : "") + "'";
    return h("article", { className: "match-event-row" }, [
      text("span", { className: "match-event-minute mono" }, minute),
      eventBadge(event),
      h("div", { className: "match-event-copy" }, [
        text("strong", {}, event.player?.name || "Unknown player"),
        metaLine([event.detail, event.assist?.name ? "Assist: " + event.assist.name : null], "meta-line muted-copy"),
      ]),
      text("span", { className: "match-event-team muted-copy" }, event.team?.name || ""),
    ]);
  }));
}

// ---------------------------------------------------------------------------
// Lineups
// ---------------------------------------------------------------------------
function lineupRow(player) {
  return h("div", { className: "lineup-api-row" }, [
    text("span", { className: "mono lineup-api-number" }, player.number ?? "\u2013"),
    text("strong", { className: "lineup-name" }, player.name || "Unknown"),
    text("span", { className: "muted-copy" }, player.pos || ""),
  ]);
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
      entry.coach?.name ? text("div", { className: "muted-copy lineup-coach" }, "Coach: " + entry.coach.name) : null,
      text("div", { className: "section-kicker" }, "Starting XI"),
      ...startXI.map(lineupRow),
      subs.length ? text("div", { className: "section-kicker lineup-sub-title" }, "Substitutes") : null,
      ...subs.slice(0, 12).map(lineupRow),
    ]);
  }));
}

// ---------------------------------------------------------------------------
// Statistics: one row per stat, home value | bar | away value
// ---------------------------------------------------------------------------
const num = (v) => {
  const n = parseFloat(String(v ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
};

function renderStats(rows) {
  const stats = Array.isArray(rows) ? rows : [];
  if (stats.length < 2) return emptyNode("Detailed match statistics are not available yet.");
  const [a, b] = stats;
  const bValues = new Map((b.statistics || []).map((s) => [s.type, s.value]));

  const lines = (a.statistics || []).map((s) => {
    const left = s.value;
    const right = bValues.get(s.type);
    const total = num(left) + num(right);
    const leftPct = total > 0 ? (num(left) / total) * 100 : 50;
    return h("div", { className: "match-stat-row" }, [
      h("div", { className: "match-stat-values" }, [
        text("strong", { className: "mono" }, left ?? "\u2013"),
        text("span", { className: "muted-copy" }, s.type),
        text("strong", { className: "mono" }, right ?? "\u2013"),
      ]),
      h("div", { className: "match-stat-bar" }, [
        h("span", { className: "match-stat-bar-home", style: { width: leftPct + "%" } }),
      ]),
    ]);
  });

  return h("section", { className: "card match-stat-card" }, [
    h("div", { className: "lineup-team-head" }, [text("strong", {}, a.team?.name || "Home"), text("strong", {}, b.team?.name || "Away")]),
    ...lines,
  ]);
}

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------
function vote(label, pct) {
  const raw = String(pct ?? "").replace("%", "");
  const width = Number.parseFloat(raw);
  return h("div", { className: "vote-cell" }, [
    text("span", {}, label),
    text("strong", { className: "mono" }, pct == null ? "\u2013" : raw + "%"),
    h("div", { className: "vote-track" }, [h("span", { style: { width: (Number.isFinite(width) ? Math.max(0, Math.min(100, width)) : 0) + "%" } })]),
  ]);
}

function renderPrediction(prediction) {
  const p = prediction?.predictions;
  if (!p) return emptyNode("Prediction data is not available for this fixture.");
  const percent = p.percent || {};
  return h("section", { className: "prediction-panel real-prediction-panel" }, [
    h("div", { className: "card prediction-card" }, [
      text("span", { className: "section-kicker" }, "API-Football prediction"),
      h("div", { className: "prediction-result" }, [
        text("strong", {}, p.winner?.name || "No winner signal"),
        p.winner?.comment ? text("span", { className: "muted-copy" }, p.winner.comment) : null,
      ]),
      p.advice ? text("div", { className: "prediction-advice" }, p.advice) : null,
    ]),
    h("div", { className: "card prediction-card" }, [
      text("div", { className: "section-kicker" }, "Win probability"),
      h("div", { className: "vote-grid" }, [vote("Home", percent.home), vote("Draw", percent.draw), vote("Away", percent.away)]),
    ]),
    p.under_over ? h("div", { className: "card prediction-card" }, [
      text("div", { className: "section-kicker" }, "Goals"),
      text("strong", { className: "prediction-advice" }, p.under_over),
    ]) : null,
  ]);
}
