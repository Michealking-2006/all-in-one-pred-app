import { h, text } from "../utils/h.js";
import { OddsTable } from "./OddsTable.js";
import { LineupPitch } from "./LineupPitch.js";
import { SkeletonMatchHero, SkeletonCards } from "./Skeleton.js";
import {
  getFixtureById, getHeadToHead, getFixtureEvents, getTeamFixtures,
  getFixtureLineups, getFixtureStatistics, getFixtureOdds, oddsRows, getFixturePlayers,
} from "../api/footballApi.js";
import { ratingMap, sortedRatings, formatRating } from "../utils/ratings.js";
import { ratingPill } from "./LineupPitch.js";
import { buildSlug } from "../utils/slug.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { isLive, isFinished, statusHeadline, resultFor, roundLabel } from "../utils/fixtures.js";
import { eventsOf, assignGoals, redCardCounts, formLetters, formatCountdown, isMissedPenalty, isRedCard } from "../utils/matchEvents.js";
import { observeFixtures } from "../liveAlerts.js";
import { setPageSeo } from "../seo.js";
import { metaForFixture, jsonLdFixture } from "../seoCore.js";
import { metaLine, setStarState, headerActions } from "../utils/ui.js";
import { openShareSheet } from "./ShareSheet.js";
import { showToast } from "../toast.js";
import { navigate } from "../router.js";

const TABS = [
  ["summary", "Summary"],
  ["events", "Events"],
  ["lineups", "Lineups"],
  ["ratings", "Ratings"],
  ["stats", "Stats"],
  ["odds", "Odds"],
  ["prediction", "Prediction"],
];

const TAB_SKELETON = { summary: "summary", events: "list", lineups: "pitch", ratings: "list", stats: "stats", odds: "list", prediction: "cards" };

export function MatchScreen({ fixtureId, matchTab = "summary", isFavorite, onBack, onToggleFavorite, onTabChange }) {
  const fixturePromise = getFixtureById(fixtureId).then((rows) => rows[0] || null);

  const hero = h("section", { className: "match-hero", "aria-busy": "true" }, [SkeletonMatchHero()]);

  const star = h("button", {
    type: "button",
    className: "icon-button match-star" + (isFavorite ? " selected" : ""),
    "aria-label": isFavorite ? "Remove favourite" : "Add favourite",
    "aria-pressed": !!isFavorite,
    onClick: () => setStarState(star, onToggleFavorite()),
  }, [h("i", { "data-lucide": "star", fill: isFavorite ? "currentColor" : "none" })]);

  // The fixture is still loading when the header first renders, so the share
  // button resolves it lazily on tap rather than waiting to appear — by the
  // time anyone can actually tap it, the scoreboard above has long since
  // needed the same data to render.
  const share = h("button", { type: "button", className: "icon-button share-header-button", "aria-label": "Share match", onClick: () => {
    fixturePromise.then((fixture) => {
      if (!fixture) { showToast("This match isn't available to share yet.", "error"); return; }
      openShareSheet("match", fixture);
    });
  } }, [h("i", { "data-lucide": "share-2" })]);

  // Everything the header shows beyond the score lives in `view`, so a refresh
  // can redraw it without losing what has already been loaded.
  const view = { fixture: null, events: null, form: { home: null, away: null } };
  const draw = (pop = false) => {
    if (!view.fixture) return;
    hero.replaceChildren(scoreboard(view.fixture, { pop, events: view.events, form: view.form }));
  };

  fixturePromise
    .then((fixture) => {
      hero.removeAttribute("aria-busy");
      if (!fixture) {
        hero.replaceChildren(text("div", { className: "muted-copy" }, "This match is no longer available."));
        return;
      }
      view.fixture = fixture;
      view.events = eventsOf(fixture);
      applyMatchSeo(fixture);
      draw();
      loadHeroExtras(fixture, view, draw);
    })
    .catch((error) => {
      hero.removeAttribute("aria-busy");
      hero.replaceChildren(text("div", { className: "async-error-state" }, error?.message || "Couldn't load this match."));
    });

  const page = createTabbedPage({
    title: "Match",
    onBack,
    action: headerActions(star, share),
    hero,
    defaultTab: matchTab,
    onTabChange,
    tabs: TABS.map(([id, label]) => ({
      id,
      label,
      skeleton: TAB_SKELETON[id],
      load: () => fixturePromise.then((fixture) => loadTab(id, fixture)),
    })),
  });

  // Live matches refresh themselves once a minute (the provider's own data only
  // moves that fast, and every poll costs one request). A change in score,
  // status or cards re-draws the scoreboard, reloads the open tab, and fires the
  // goal vibration / half-time and full-time whistles via liveAlerts.
  fixturePromise.then((fixture) => {
    if (!fixture) return;
    observeFixtures([fixture]); // first sighting: remember it, no alerts
    let started = false;
    const begin = () => {
      if (started || !hero.isConnected) return;
      started = true;
      startPolling(view.fixture || fixture, fixtureId, hero, page, (next, scored) => {
        view.fixture = next;
        if (eventsOf(next)) view.events = eventsOf(next);
        applyMatchSeo(next);
        draw(scored);
      });
    };
    if (shouldPoll(fixture)) begin();
    else if (fixture.fixture?.status?.short === "NS") {
      // Not live yet: start refreshing a few minutes before kick-off (the
      // countdown on screen reaches zero around then).
      const wait = new Date(fixture.fixture?.date).getTime() - Date.now() - 5 * 60_000;
      if (Number.isFinite(wait) && wait < 24 * 3_600_000) window.setTimeout(begin, Math.max(0, wait));
    }
  }).catch(() => {});

  return page;
}

function applyMatchSeo(fixture) {
  const path = window.location.pathname;
  const meta = metaForFixture(fixture, path);
  setPageSeo({ title: meta.title, description: meta.description, jsonLd: jsonLdFixture(fixture, window.location.origin + path) });
}

// Last-five form for both teams, and events when the fixture didn't carry them.
function loadHeroExtras(fixture, view, draw) {
  const status = fixture.fixture?.status?.short;
  if (view.events == null && status !== "NS") {
    getFixtureEvents(fixture.fixture.id).then((rows) => { view.events = Array.isArray(rows) ? rows : []; draw(); }).catch(() => {});
  }
  for (const side of ["home", "away"]) {
    const team = fixture.teams?.[side];
    if (!team?.id) continue;
    getTeamFixtures(team.id, { last: 8 })
      .then((rows) => {
        view.form[side] = formLetters(rows, team.id, fixture.fixture?.date, resultFor);
        draw();
      })
      .catch(() => {});
  }
}

const POLL_MS = 60_000;
const scoreSignature = (fx) => [fx.fixture?.status?.short, fx.goals?.home, fx.goals?.away, (fx.events || []).length].join("|");

function shouldPoll(fx) {
  const status = fx.fixture?.status?.short;
  if (isLive(status)) return true;
  if (status !== "NS") return false;
  const kickoff = new Date(fx.fixture?.date).getTime();
  return Number.isFinite(kickoff) && Date.now() >= kickoff - 5 * 60_000 && Date.now() <= kickoff + 6 * 3_600_000;
}

function startPolling(initial, fixtureId, hero, page, onUpdate) {
  let current = initial;
  const timer = window.setInterval(async () => {
    if (!hero.isConnected) { window.clearInterval(timer); return; }
    if (document.hidden) return;
    if (!shouldPoll(current)) { window.clearInterval(timer); return; }
    try {
      const next = (await getFixtureById(fixtureId))[0];
      if (!next || !hero.isConnected) return;
      observeFixtures([next]);
      if (scoreSignature(next) !== scoreSignature(current)) {
        const scored = (next.goals?.home ?? 0) + (next.goals?.away ?? 0) > (current.goals?.home ?? 0) + (current.goals?.away ?? 0);
        onUpdate(next, scored);
        page.reload?.();
      }
      current = next;
    } catch {
      // A failed refresh keeps the last good scoreboard; the next tick retries.
    }
  }, POLL_MS);
}

function loadTab(tab, fixture) {
  if (!fixture) return emptyNode("This match is no longer available from the football data provider.");
  const id = fixture.fixture.id;

  // A single-fixture response normally carries events / lineups / statistics /
  // player ratings too. Once the match is over they can't change, so use them
  // instead of spending a request per tab; live matches always ask fresh.
  const over = isFinished(fixture.fixture?.status?.short);
  const embedded = (key) => (over && Array.isArray(fixture[key]) && fixture[key].length ? Promise.resolve(fixture[key]) : null);
  const eventsData = () => embedded("events") || getFixtureEvents(id);
  const playersData = () => embedded("players") || getFixturePlayers(id);

  if (tab === "events") return eventsData().then(renderEvents);
  if (tab === "lineups") {
    // Events are optional (they only add goal / card / substitution badges).
    // Ratings are optional too: a failure or an empty list just means no pills.
    return Promise.all([embedded("lineups") || getFixtureLineups(id), eventsData().catch(() => []), playersData().catch(() => [])]).then(([lineups, events, players]) => {
      const view = LineupPitch({ fixture, lineups, events, ratings: ratingMap(players) });
      return view || emptyNode("Lineups are not available for this match yet.");
    });
  }
  if (tab === "ratings") return playersData().then((payload) => renderRatings(payload, fixture));
  if (tab === "stats") return (embedded("statistics") || getFixtureStatistics(id)).then(renderStats);
  if (tab === "odds") return getFixtureOdds(id).then((payload) => OddsTable({ match: { odds: oddsRows(payload) } }));
  // Predictions are intentionally empty for now (no third-party prediction data).
  if (tab === "prediction") return Promise.resolve(emptyNode("Predictions are coming soon."));
  return Promise.resolve(renderSummary(fixture));
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
const FORM_WORD = { W: "win", D: "draw", L: "loss" };

// Last five results, oldest to newest, the latest ringed. The slot keeps its
// height while loading so the header doesn't jump when the form arrives.
function formStrip(letters, teamName) {
  const strip = h("div", { className: "match-form" });
  if (!letters?.length) return strip;
  strip.setAttribute("role", "img");
  strip.setAttribute("aria-label", (teamName || "Team") + " last " + letters.length + " matches, oldest to newest: " + letters.map((l) => FORM_WORD[l]).join(", "));
  letters.forEach((letter, i) => {
    strip.appendChild(h("span", { className: "form-chip " + (FORM_WORD[letter] || "draw") + (i === letters.length - 1 ? " latest" : ""), "aria-hidden": "true" }, letter));
  });
  return strip;
}

function redCardBadge(count) {
  if (!count) return null;
  return h("span", { className: "red-card-badge", role: "img", "aria-label": count + (count > 1 ? " red cards" : " red card") }, count > 1 ? String(count) : "");
}

function teamBlock(team, away, { form = null, reds = 0 } = {}) {
  const inner = [
    h("span", { className: "match-logo-wrap" }, [
      team?.logo ? h("img", { className: "match-team-logo", src: team.logo, alt: "" }) : h("span", { className: "match-team-logo" }),
      redCardBadge(reds),
    ]),
    text("strong", {}, team?.name || "TBD"),
    formStrip(form, team?.name),
  ];
  const props = { type: "button", className: "match-side" + (away ? " away-side" : "") };
  if (team?.id) return h("button", { ...props, onClick: () => navigate("/club/" + team.id), "aria-label": "Open " + team.name }, inner);
  return h("div", props, inner);
}

// Live ticking countdown to kick-off. Stops itself when it leaves the page.
function countdown(kickoffMs) {
  const value = h("strong", { className: "match-countdown-value mono" });
  const node = h("div", { className: "match-score-big match-countdown", role: "timer", "aria-label": "Time until kick-off" }, [
    text("span", { className: "match-countdown-label" }, "Kick-off in"),
    value,
  ]);
  const tick = () => {
    const left = kickoffMs - Date.now();
    value.textContent = left > 0 ? formatCountdown(left) : "Starting soon";
    node.classList.toggle("is-due", left <= 0);
  };
  tick();
  const timer = window.setInterval(() => {
    if (!node.isConnected) { window.clearInterval(timer); return; }
    tick();
  }, 1000);
  return node;
}

function scorersColumn(entries, away) {
  return h("ul", { className: "match-scorers-col" + (away ? " away" : "") }, entries.map((e) =>
    h("li", {}, [
      text("span", { className: "scorer-name" }, e.name),
      text("span", { className: "scorer-min mono" }, e.minutes.join(" ") + (e.own ? " OG" : e.penalty ? " (P)" : "")),
    ])
  ));
}

function scorersRow(fx, events) {
  if (!Array.isArray(events)) return null;
  const { home, away } = assignGoals(events, fx);
  if (!home.length && !away.length) return null;
  return h("div", { className: "match-scorers", "aria-label": "Goal scorers" }, [scorersColumn(home, false), h("span", { className: "match-scorers-ball", "aria-hidden": "true" }), scorersColumn(away, true)]);
}

function scoreboard(fx, { pop = false, events = null, form = {} } = {}) {
  const status = fx.fixture?.status?.short;
  const live = isLive(status);
  const goals = fx.goals || {};
  const headline = statusHeadline(fx);
  const reds = redCardCounts(events, fx);
  const kickoff = new Date(fx.fixture?.date).getTime();
  // Not started yet: count down instead of showing dashes.
  const showCountdown = status === "NS" && Number.isFinite(kickoff);
  return h("div", {}, [
    metaLine([fx.league?.name, roundLabel(fx.league?.round)], "meta-line match-league-line"),
    h("span", { className: live ? "match-live-label" : "match-status" },
      live ? [h("span", { className: "live-dot" }), text("span", {}, headline)] : headline),
    h("div", { className: "match-scoreboard" }, [
      teamBlock(fx.teams?.home, false, { form: form.home, reds: reds.home }),
      showCountdown
        ? countdown(kickoff)
        : text("div", { className: "match-score-big mono" + (pop ? " score-pop" : "") }, (goals.home ?? "\u2013") + " \u2013 " + (goals.away ?? "\u2013")),
      teamBlock(fx.teams?.away, true, { form: form.away, reds: reds.away }),
    ]),
    scorersRow(fx, events),
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
    infoRow("Round", roundLabel(league.round)),
    infoRow("Venue", [fixtureInfo.venue?.name, fixtureInfo.venue?.city].filter(Boolean).join(", ")),
    infoRow("Referee", fixtureInfo.referee),
    infoRow("Kick-off", formatDate(fixtureInfo.date)),
    infoRow("Half-time", score.halftime?.home != null ? score.halftime.home + " \u2013 " + score.halftime.away : null),
  ].filter(Boolean);

  const h2hSlot = h("div", { className: "h2h-loading" }, [SkeletonCards({ count: 1 })]);
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
  // A missed penalty arrives as type "Goal": it is not a goal.
  if (isMissedPenalty(event)) return h("span", { className: "event-badge ev-missed" }, "Missed");
  if (type === "goal") return h("span", { className: "event-badge ev-goal" }, /own/.test(detail) ? "OG" : "Goal");
  if (type === "card") return h("span", { className: "event-badge ev-card " + (isRedCard(event) ? "ev-red" : "ev-yellow"), "aria-label": event.detail }, "");
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
// Player ratings: every rated player of each side, best first
// ---------------------------------------------------------------------------
function ratingRow(entry, isTop) {
  return h("button", { type: "button", className: "rating-row", "aria-label": entry.name + ", rated " + formatRating(entry.rating), onClick: () => navigate("/player/" + buildSlug(entry.id, entry.name)) }, [
    entry.photo ? h("img", { className: "rating-photo", src: entry.photo, alt: "", loading: "lazy" }) : h("span", { className: "rating-photo" }),
    h("div", { className: "rating-copy" }, [
      text("strong", {}, entry.name),
      metaLine([entry.pos, entry.minutes != null ? entry.minutes + "'" : null], "meta-line muted-copy"),
    ]),
    isTop ? text("span", { className: "rating-top-tag" }, "Top rated") : null,
    ratingPill(entry),
  ]);
}

function renderRatings(payload, fixture) {
  const map = ratingMap(payload);
  if (!map.size) return emptyNode("Player ratings appear once the match is under way.");
  const best = [...map.values()].reduce((a, b) => (b.rating > a.rating ? b : a));
  const sides = [fixture.teams?.home, fixture.teams?.away].filter(Boolean);
  const cards = sides.map((team) => {
    const rows = sortedRatings(map, team.id);
    if (!rows.length) return null;
    return h("section", { className: "card ratings-card" }, [
      h("div", { className: "bench-head" }, [
        team.logo ? h("img", { className: "bench-logo", src: team.logo, alt: "" }) : null,
        h("div", { className: "bench-title" }, [text("strong", {}, team.name || "Team")]),
      ]),
      ...rows.map((entry) => ratingRow(entry, entry.id === best.id)),
    ]);
  }).filter(Boolean);
  return h("section", { className: "ratings-view" }, cards.length ? cards : [emptyNode("Player ratings are not available for this match.")]);
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
