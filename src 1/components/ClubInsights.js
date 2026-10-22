// Cards for the club Overview: last five results, top performers, a slice of the league table and
// the league-position history. Small on purpose: few elements, no photos except player faces.
import { h, text } from "../utils/h.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";
import { getTeamStandings } from "../api/footballApi.js";
import { seasonLabel } from "../utils/fixtures.js";
import { isUltraLow } from "../perf.js";
import { lastResults, formString, topPerformers, standingsWindow, seasonRank, historyChart } from "../clubStats.js";

const RESULT_WORD = { W: "Won", D: "Drew", L: "Lost" };
const KIND = { W: "win", D: "draw", L: "loss" };

// Five result chips (W/D/L, oldest to newest), for the club header.
export function heroForm(fixtures, teamId) {
  const letters = formString(fixtures, teamId, 5).split("");
  if (!letters.length) return null;
  return h("div", { className: "hero-form", role: "img", "aria-label": "Last " + letters.length + " results, oldest to newest: " + letters.join(", ") },
    letters.map((l) => text("span", { className: "form-chip " + KIND[l] }, l)));
}

// "Last 5 matches": the opponent's crest over the score as played, coloured by the result for this club.
export function lastFiveCard(fixtures, teamId) {
  const results = lastResults(fixtures, teamId, 5);
  if (!results.length) return null;
  return h("section", { className: "card last-five" }, [
    text("h3", { className: "card-title" }, "Last " + results.length + " matches"),
    h("div", { className: "last-five-row", style: { "--n": String(results.length) } }, results.map((r) => h("button", {
      type: "button", className: "last-five-item",
      "aria-label": `${RESULT_WORD[r.result]} ${r.score} ${r.home ? "at home to" : "away at"} ${r.opponent.name}`,
      onClick: () => r.fixtureId && navigate("/match/" + r.fixtureId),
    }, [
      r.opponent.logo ? h("img", { className: "last-five-crest", src: r.opponent.logo, alt: "", loading: "lazy", decoding: "async", width: "44", height: "44" }) : h("span", { className: "last-five-crest" }),
      text("span", { className: "score-badge " + KIND[r.result] }, r.score),
    ]))),
  ]);
}

function performerCard(person, value, label, ariaLabel) {
  return h("button", { type: "button", className: "performer", "aria-label": ariaLabel, onClick: () => navigate("/player/" + buildSlug(person.id, person.name)) }, [
    h("div", { className: "performer-top" }, [
      person.photo ? h("img", { className: "performer-photo", src: person.photo, alt: "", loading: "lazy", decoding: "async", width: "56", height: "56" }) : h("span", { className: "performer-photo" }),
      text("span", { className: "performer-name" }, person.name),
    ]),
    h("div", { className: "performer-bottom" }, [text("strong", { className: "mono" }, value), text("span", {}, label)]),
  ]);
}

// "Top performers": top scorer (penalties in brackets), most assists and highest average rating.
export function topPerformersCard(rows, teamId) {
  const { scorer, assister, rated } = topPerformers(rows, teamId);
  const cards = [];
  if (scorer) cards.push(performerCard(scorer, scorer.pens > 0 ? `${scorer.goals}(${scorer.pens})` : String(scorer.goals), "Goals", `Top scorer: ${scorer.name}, ${scorer.goals} goals`));
  if (assister) cards.push(performerCard(assister, String(assister.assists), "Assists", `Most assists: ${assister.name}, ${assister.assists}`));
  if (rated) cards.push(performerCard(rated, rated.rating.toFixed(1), "Rating", `Best rated: ${rated.name}, ${rated.rating.toFixed(1)}`));
  if (!cards.length) return null;
  return h("div", { className: "performers" }, cards);
}

// "Standings": three rows around the club, the club highlighted.
export function standingsCard(table, teamId, { league, onOpenLeague } = {}) {
  const rows = standingsWindow(table?.rows, teamId, 3);
  if (!rows.length) return null;
  const head = h("div", { className: "mini-standings-row head" }, ["#", "Team", "P", "W", "D", "L", "GD", "Pts"].map((c, i) => text("span", { className: i === 1 ? "ms-team" : "" }, c)));
  const body = rows.map((r) => h("button", {
    type: "button", className: "mini-standings-row" + (r.team.id === teamId ? " me" : ""),
    "aria-label": `${r.rank}. ${r.team.name}, ${r.points} points`,
    onClick: () => navigate("/club/" + buildSlug(r.team.id, r.team.name)),
  }, [
    text("span", { className: "mono" }, r.rank),
    h("span", { className: "ms-team" }, [r.team.logo ? h("img", { src: r.team.logo, alt: "", loading: "lazy", decoding: "async", width: "20", height: "20" }) : null, text("span", {}, r.team.name)]),
    text("span", { className: "mono" }, r.all?.played ?? "–"), text("span", { className: "mono" }, r.all?.win ?? "–"), text("span", { className: "mono" }, r.all?.draw ?? "–"), text("span", { className: "mono" }, r.all?.lose ?? "–"),
    text("span", { className: "mono" }, r.goalsDiff > 0 ? "+" + r.goalsDiff : r.goalsDiff ?? "–"),
    text("strong", { className: "mono" }, r.points ?? "–"),
  ]));
  return h("section", { className: "card mini-standings" }, [
    h("div", { className: "mini-standings-head" }, [
      text("span", { className: "muted-copy" }, league?.name || "League table"),
      onOpenLeague ? h("button", { type: "button", className: "text-action", onClick: onOpenLeague }, "Full table") : null,
    ]),
    head, ...body,
  ]);
}

// ---------------------------------------------------------------------------
// League position history. One request per past season, so it only starts when the reader asks, runs two at
// a time, and every finished season is saved on the device for good (a past table never changes).
// ---------------------------------------------------------------------------
const HIST_KEY = "scoutwave.hist.v1.";
const read = (key) => { try { return JSON.parse(window.localStorage.getItem(key) || "null"); } catch { return null; } };
const write = (key, value) => { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full: it just loads again next time */ } };

async function loadSeason(teamId, season, leagueId, isPast) {
  const key = HIST_KEY + teamId + "." + season;
  if (isPast) { const saved = read(key); if (saved && "rank" in saved) return saved; }
  const found = seasonRank(await getTeamStandings(teamId, season), teamId, leagueId) || { rank: null };
  if (isPast) write(key, found);
  return found;
}

export async function loadHistory(teamId, seasons, leagueId, currentSeason, { isStale = () => false, onProgress } = {}) {
  const out = new Map();
  let next = 0, done = 0;
  const worker = async () => {
    while (next < seasons.length && !isStale()) {
      const season = seasons[next++];
      try { out.set(season, await loadSeason(teamId, season, leagueId, season < currentSeason)); } catch { out.set(season, { rank: null, failed: true }); }
      onProgress?.(++done, seasons.length);
    }
  };
  await Promise.all([worker(), worker()]);
  return seasons.map((season) => ({ season, ...(out.get(season) || { rank: null }) }));
}

const NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}) { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v)); return el; }

export function historyChartNode(points, base) {
  const geo = historyChart(points);
  const root = svg("svg", { viewBox: `0 0 ${geo.width} ${geo.height}`, class: "history-svg", role: "img", "aria-label": "League position by season: " + points.filter((p) => p.rank != null).map((p) => `${seasonLabel(base, p.season)} #${p.rank}`).join(", ") });
  for (const t of geo.ticks) root.append(svg("line", { x1: 12, x2: geo.width - 12, y1: t.y, y2: t.y, class: "history-grid" }));
  for (const seg of geo.segments) if (seg.length > 1) root.append(svg("polyline", { points: seg.map((c) => `${c.x},${c.y}`).join(" "), class: "history-line" }));
  const every = Math.ceil(points.length / 5);
  geo.coords.forEach((c, i) => {
    if (c) {
      root.append(svg("circle", { cx: c.x, cy: c.y, r: 4.5, class: "history-dot" }));
      const label = svg("text", { x: c.x, y: c.y + 16, class: "history-rank", "text-anchor": "middle" }); label.textContent = String(c.rank); root.append(label);
    }
    if (i % every === 0 || i === points.length - 1) {
      const axis = svg("text", { x: geo.coords[i]?.x ?? (22 + (i / Math.max(1, points.length - 1)) * (geo.width - 44)), y: geo.height - 1, class: "history-season", "text-anchor": "middle" });
      axis.textContent = seasonLabel(base, points[i].season); root.append(axis);
    }
  });
  return root;
}

export function historyCard({ teamId, seasons, leagueId, currentSeason, entry }) {
  const years = [...new Set(seasons)].filter(Number.isInteger).sort((a, b) => a - b).slice(-(isUltraLow() ? 6 : 9));
  if (years.length < 2) return null;
  const body = h("div", { className: "history-body" });
  const button = h("button", { type: "button", className: "secondary-button history-load" }, "Show league positions by season");
  const note = text("p", { className: "muted-copy history-note" }, `Uses ${years.length} lookups, once. They are saved on your device.`);
  body.append(button, note);
  let token = 0;
  button.addEventListener("click", async () => {
    const mine = ++token;
    button.disabled = true;
    try {
      const points = await loadHistory(teamId, years, leagueId, currentSeason, {
        isStale: () => mine !== token || !body.isConnected,
        onProgress: (done, total) => { button.textContent = `Loading ${done} of ${total}…`; },
      });
      if (!body.isConnected) return;
      if (!points.some((p) => p.rank != null)) { body.replaceChildren(text("p", { className: "muted-copy" }, "No league positions are available for this club.")); return; }
      body.replaceChildren(historyChartNode(points, entry));
    } catch {
      button.disabled = false; button.textContent = "Try again";
    }
  });
  return h("section", { className: "card history-card" }, [text("h3", { className: "card-title" }, "History rankings"), body]);
}
