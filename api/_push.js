// Push alerts (lineups, goals, kick-offs, half-time, full-time) for matches and clubs people
// have starred, delivered even when the app is closed. Run by api/cron.js?task=push.
// The leading underscore keeps Vercel from exposing this file as a route.
//
// How it works: one football API call per run (fixtures?live=all) gives every match in play.
// Only matches somebody watches are compared with the last state saved in push_fixture_state,
// and only CHANGES become alerts. Matches that drop off the live list get one more call to
// read the final score. State is saved BEFORE sending, so a crash can miss an alert but
// never repeats one.
import { env, sb } from "./_admin.js";
import { football, footballStatus } from "./_predict.js";
import { recordUsage } from "./_usage.js";
import { q } from "./_query.js";

const LIVE = new Set(["1H", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);
const FINISHED = new Set(["FT", "AET", "PEN"]);
const num = (name, fallback) => { const v = Number(env(name)); return env(name) !== "" && Number.isFinite(v) ? v : fallback; };

export const pushConfigured = () => !!(env("VAPID_PUBLIC_KEY") && env("VAPID_PRIVATE_KEY") && env("VAPID_SUBJECT"));

// Real sender (the web-push package). Tests pass their own.
export async function makeSender() {
  if (!pushConfigured()) throw new Error("Push keys are not set.");
  const mod = await import("web-push");
  const webpush = mod.default || mod;
  webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  return (sub, payload) => webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 600, urgency: "high" });
}

const wants = (sub, type) => {
  const p = sub.prefs || {};
  return type === "goal" ? p.goals === true : type === "kickoff" ? p.kickoff === true : type === "lineups" ? p.lineups === true : type === "player" ? p.players === true : p.whistles === true; // half and full time
};
const watches = (sub, fx) =>
  (sub.fixtures || []).map(Number).includes(Number(fx.id)) || [fx.homeId, fx.awayId].some((t) => (sub.teams || []).map(Number).includes(Number(t)));

const flat = (fx) => ({
  id: fx.fixture?.id, status: fx.fixture?.status?.short || "", elapsed: fx.fixture?.status?.elapsed ?? null,
  gh: fx.goals?.home ?? 0, ga: fx.goals?.away ?? 0,
  homeId: fx.teams?.home?.id, awayId: fx.teams?.away?.id,
  home: String(fx.teams?.home?.name || "Home").slice(0, 40), away: String(fx.teams?.away?.name || "Away").slice(0, 40),
});

// The text of each alert. No scorer names: the live feed doesn't carry them without extra calls.
export function messageFor(type, fx, prev) {
  const score = `${fx.home} ${fx.gh}\u2013${fx.ga} ${fx.away}`;
  const url = `/match/${fx.id}`;
  if (type === "goal") {
    const side = fx.gh > (prev?.goals_home ?? 0) ? fx.home : fx.ga > (prev?.goals_away ?? 0) ? fx.away : null;
    return { type, title: score, body: side ? `Goal for ${side}${fx.elapsed ? ` (${fx.elapsed}')` : ""}` : "The score has changed", tag: `fx${fx.id}-goal-${fx.gh + fx.ga}`, url };
  }
  if (type === "lineups") return { type, title: "Lineups are in", body: `${fx.home} v ${fx.away}${fx.formations ? ` (${fx.formations})` : ""}${fx.minutesTo > 0 ? `. Kick-off in ${fx.minutesTo} min.` : "."}`.slice(0, 150), tag: `fx${fx.id}-lineups`, url };
  if (type === "kickoff") return { type, title: "Kick-off", body: `${fx.home} v ${fx.away} has started`, tag: `fx${fx.id}-kickoff`, url };
  if (type === "half") return { type, title: "Half-time", body: score, tag: `fx${fx.id}-half`, url };
  return { type: "full", title: "Full-time", body: score, tag: `fx${fx.id}-full`, url };
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

// ---------------------------------------------------------------------------
// Lineup alerts: "the team sheets are out", about an hour before kick-off.
// The day's match list is one request, remembered for 30 minutes (api_cache, free to re-read). A lineup check is one
// request per watched match that starts within the window, remembered for 4 minutes whether or not the sheets are out,
// so a quiet hour costs a handful of requests, and none at all when nobody who asked for lineup alerts watches a match.
// A match is marked in push_fixture_state BEFORE its alert is sent (migration 011), so a crash can miss an alert but
// never repeat one. If that column isn't there yet, nothing is sent (the summary says so) rather than risk repeats.
// ---------------------------------------------------------------------------
const lineupWindowMin = () => Math.max(20, Math.min(180, Math.floor(num("PUSH_LINEUP_MINUTES", 75))));
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// Are both team sheets complete? Returns the formations, or null. Exported for tests.
export function readLineups(response, homeId, awayId) {
  const sheets = Array.isArray(response) ? response.filter((l) => Array.isArray(l?.startXI) && l.startXI.length >= 11) : [];
  if (sheets.length < 2) return null;
  const of = (id) => sheets.find((l) => Number(l.team?.id) === Number(id));
  const home = of(homeId), away = of(awayId);
  if (!home || !away) return null;
  const f = (l) => String(l.formation || "").replace(/[^0-9-]/g, "").slice(0, 12);
  return { home: f(home), away: f(away) };
}

async function lineupJobs(subs, { now, budget, summary }) {
  const wantsIt = subs.filter((s) => s.prefs?.lineups === true && ((s.fixtures || []).length || (s.teams || []).length));
  summary.lineupWatchers = wantsIt.length;
  if (!wantsIt.length) return [];
  const window = lineupWindowMin();
  const days = [...new Set([utcDay(now), utcDay(now + window * 60000)])];
  const candidates = [];
  for (const date of days) {
    const data = await football(budget, "fixtures", { date }, "push", { cacheMinutes: 30 });
    for (const x of data?.response || []) {
      const fx = flat(x);
      const kickoff = Date.parse(x.fixture?.date);
      if (!fx.id || !Number.isFinite(kickoff) || !["NS", "TBD"].includes(fx.status)) continue;
      const minutesTo = Math.ceil((kickoff - now) / 60000);
      if (minutesTo > window || minutesTo < -2) continue;
      if (wantsIt.some((s) => watches(s, fx))) candidates.push({ ...fx, minutesTo });
    }
  }
  summary.lineupCandidates = candidates.length;
  if (!candidates.length) return [];

  const ids = candidates.map((c) => c.id);
  let done;
  try {
    const rows = (await sb(`/rest/v1/push_fixture_state?fixture_id=in.(${q.ints(ids)})&select=fixture_id,lineup_sent&limit=200`)) || [];
    done = new Set(rows.filter((r) => r.lineup_sent === true).map((r) => Number(r.fixture_id)));
  } catch { summary.lineupSkipped = "run supabase/migrations/011_lineup_alerts.sql to switch lineup alerts on"; return []; }

  const events = [];
  for (const fx of candidates.filter((c) => !done.has(c.id)).sort((a, b) => a.minutesTo - b.minutesTo).slice(0, num("PUSH_LINEUP_MAX_CHECKS", 8))) {
    const data = await football(budget, "fixtures/lineups", { fixture: fx.id }, "push", { cacheMinutes: 4 });
    const sheets = readLineups(data?.response, fx.homeId, fx.awayId);
    if (sheets) events.push({ ...fx, formations: sheets.home && sheets.away ? `${sheets.home} v ${sheets.away}` : "" });
  }
  if (!events.length) return [];

  // Mark them first, then hand the alerts back to be sent.
  try {
    await sb("/rest/v1/push_fixture_state?on_conflict=fixture_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: events.map((fx) => ({ fixture_id: fx.id, live: false, status: fx.status, goals_home: 0, goals_away: 0, home_id: fx.homeId, away_id: fx.awayId, home_name: fx.home, away_name: fx.away, lineup_sent: true, updated_at: new Date(now).toISOString() })) });
  } catch { summary.lineupSkipped = "could not record lineup alerts; nothing sent"; return []; }
  summary.lineups = events.length;
  const jobs = [];
  for (const fx of events) {
    const msg = messageFor("lineups", fx, null);
    for (const sub of wantsIt) if (watches(sub, fx)) jobs.push({ sub, msg });
  }
  return jobs;
}

// Send, then tidy up devices that are gone or keep failing. Shared by every kind of alert.
async function deliver(jobs, allSubs, summary, send) {
  if (!jobs.length) return;
  const sender = send || (await makeSender());
  const dead = new Set(), failed = new Map();
  await inBatches(jobs.slice(0, 1500), 10, async ({ sub, msg }) => {
    try { await sender(sub, msg); summary.sent++; }
    catch (error) {
      summary.failed++;
      const code = error?.statusCode;
      if (code === 404 || code === 410) dead.add(sub.endpoint);
      else failed.set(sub.endpoint, (failed.get(sub.endpoint) || 0) + 1);
    }
  });
  for (const endpoint of dead) { await sb(`/rest/v1/push_subscriptions?endpoint=eq.${q.text(endpoint)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {}); summary.removed++; }
  for (const [endpoint, n] of failed) {
    const sub = allSubs.find((s) => s.endpoint === endpoint);
    const count = (sub?.fail_count || 0) + n;
    await sb(`/rest/v1/push_subscriptions?endpoint=eq.${q.text(endpoint)}`, count >= 8 ? { method: "DELETE", headers: { Prefer: "return=minimal" } } : { method: "PATCH", headers: { Prefer: "return=minimal" }, body: { fail_count: count } }).catch(() => {});
    if (count >= 8) summary.removed++;
  }
  await recordUsage("push", "sent", summary.sent, 0);
  if (summary.failed) await recordUsage("push", "failed", summary.failed, 0);
}

// ---------------------------------------------------------------------------
// Followed players: a goal, an assist or a card for a player somebody starred, announced once.
// Needs migration 012 (the followed players, and which events of a match were already seen). A match's events are only
// looked at while one of its clubs has a follower, at most PUSH_PLAYER_MAX_CHECKS matches per run, each remembered for a
// minute. The first look at a match only records what had already happened: nothing old is ever announced.
// ---------------------------------------------------------------------------
const PLAYING = new Set(["1H", "2H", "ET", "HT", "BT", "P", "LIVE", "INT"]);
const followsTeam = (sub, fx) => Object.values(sub.players || {}).map(Number).some((t) => t === Number(fx.homeId) || t === Number(fx.awayId));
const followed = (sub, playerId, fx) => { const t = Number((sub.players || {})[playerId]); return !!t && (t === Number(fx.homeId) || t === Number(fx.awayId)); };
const minuteOf = (ev) => (ev.time?.elapsed ?? "") + (ev.time?.extra ? "+" + ev.time.extra : "");

// Everything in a match's events that could be an alert: [{ key, kind, playerId, name, minute }]. Exported for tests.
export function playerEvents(events) {
  const out = [];
  for (const ev of Array.isArray(events) ? events : []) {
    const type = String(ev.type || "").toLowerCase(), detail = String(ev.detail || "").toLowerCase();
    const base = [minuteOf(ev), ev.type, ev.detail, ev.player?.id || 0, ev.assist?.id || 0].join("|");
    const add = (who, kind) => { if (who?.id) out.push({ key: base + "|" + kind, kind, playerId: Number(who.id), name: String(who.name || "Player").slice(0, 40), minute: minuteOf(ev) + "'" }); };
    if (type === "goal") {
      if (detail.includes("missed")) continue;
      add(ev.player, detail.includes("own") ? "owngoal" : detail.includes("pen") ? "penalty" : "goal");
      if (!detail.includes("own")) add(ev.assist, "assist");
    } else if (type === "card") add(ev.player, detail.includes("red") || detail.includes("second") ? "red" : "yellow");
  }
  return out;
}
const WORDS = { goal: "scored", penalty: "scored a penalty", owngoal: "scored an own goal", assist: "set up a goal", yellow: "was booked", red: "was sent off" };
export const playerMessage = (a, fx) => ({ type: "player", title: `${a.name} ${WORDS[a.kind]}`, body: `${fx.home} ${fx.gh}\u2013${fx.ga} ${fx.away} (${a.minute})`, tag: `fx${fx.id}-p${a.playerId}-${a.kind}-${a.minute}`, url: `/match/${fx.id}` });

async function playerJobs(subs, live, { budget, summary }) {
  const candidates = live.filter((fx) => PLAYING.has(fx.status) && subs.some((s) => followsTeam(s, fx)))
    .sort((a, b) => subs.filter((s) => followsTeam(s, b)).length - subs.filter((s) => followsTeam(s, a)).length)
    .slice(0, Math.max(1, Math.floor(num("PUSH_PLAYER_MAX_CHECKS", 6))));
  summary.playerMatches = candidates.length;
  if (!candidates.length) return [];

  const known = new Map(); // fixture id -> keys already seen (null: never looked at)
  try {
    const rows = (await sb(`/rest/v1/push_fixture_state?fixture_id=in.(${q.ints(candidates.map((c) => c.id))})&select=fixture_id,event_keys&limit=200`)) || [];
    for (const r of rows) known.set(Number(r.fixture_id), Array.isArray(r.event_keys) ? r.event_keys : null);
  } catch { summary.playerSkipped = "run supabase/migrations/012_follow_players.sql to switch followed-player alerts on"; return []; }

  const jobs = [];
  for (const fx of candidates) {
    const data = await football(budget, "fixtures/events", { fixture: fx.id }, "push", { cacheMinutes: 1 });
    if (!Array.isArray(data?.response)) continue;
    const all = playerEvents(data.response); // every goal, assist and card, not only the followed ones: a new follower never gets old events
    const before = known.get(fx.id) || null;
    const seen = new Set(before || []);
    const fresh = before ? all.filter((a) => !seen.has(a.key)) : [];
    try { await sb(`/rest/v1/push_fixture_state?fixture_id=eq.${q.int(fx.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: { event_keys: [...new Set([...seen, ...all.map((a) => a.key)])].slice(-250) } }); }
    catch { summary.playerSkipped = "could not record seen events; nothing sent"; continue; }
    for (const a of fresh) {
      const msg = playerMessage(a, fx);
      for (const sub of subs) if (followed(sub, a.playerId, fx)) jobs.push({ sub, msg });
    }
  }
  summary.playerAlerts = new Set(jobs.map((j) => j.msg.tag)).size;
  return jobs;
}

export async function runPush({ now = Date.now(), send } = {}) {
  const summary = { job: "push", subscribers: 0, watching: 0, events: 0, sent: 0, failed: 0, removed: 0, callsUsed: 0 };
  if (!pushConfigured() && !send) { summary.skipped = "push keys are not set"; return summary; }

  let subs;
  try { subs = (await sb("/rest/v1/push_subscriptions?select=endpoint,p256dh,auth,prefs,fixtures,teams,fail_count,players&limit=5000")) || []; }
  catch { subs = (await sb("/rest/v1/push_subscriptions?select=endpoint,p256dh,auth,prefs,fixtures,teams,fail_count&limit=5000")) || []; } // before migration 012: no followed players yet
  summary.subscribers = subs.length;
  const watching = (s) => (s.fixtures || []).length || (s.teams || []).length;
  const active = subs.filter((s) => ["goals", "kickoff", "whistles"].some((k) => s.prefs?.[k] === true) && watching(s)); // live alerts
  const lineupSubs = subs.filter((s) => s.prefs?.lineups === true && watching(s));
  const playerSubs = subs.filter((s) => s.prefs?.players === true && Object.keys(s.players || {}).length);
  if (!active.length && !lineupSubs.length && !playerSubs.length) { summary.skipped = "nobody is watching a match"; return summary; }

  // Keep a share of today's football API quota free for the app and the other jobs.
  const quota = await footballStatus();
  const keepFree = num("PUSH_KEEP_FREE_SHARE", 0.25);
  if (!(quota.limit > 0) || quota.limit - quota.used <= quota.limit * keepFree) { summary.skipped = "football API quota is being kept free for the app"; return summary; }
  // Lineup alerts have their own small budget (they never eat into the live-score calls below).
  const lineupBudget = { calls: 1 + Math.floor(num("PUSH_LINEUP_MAX_CHECKS", 8)) + 1, spent: 0 };
  let lineupJobsNow = [];
  if (lineupSubs.length) {
    try { lineupJobsNow = await lineupJobs(lineupSubs, { now, budget: lineupBudget, summary }); }
    catch (error) { summary.lineupSkipped = "lineup check failed"; console.error("lineup alerts failed:", error?.message || error); }
  }
  summary.callsUsed = lineupBudget.spent;
  if (!active.length && !playerSubs.length) { await deliver(lineupJobsNow, subs, summary, send); return summary; }

  const budget = { calls: 2, spent: 0 };

  const liveData = await football(budget, "fixtures", { live: "all" }, "push");
  if (!liveData) { await deliver(lineupJobsNow, subs, summary, send); summary.callsUsed += budget.spent; summary.skipped = "could not read live matches"; return summary; }
  const live = (liveData.response || []).map(flat).filter((fx) => fx.id && (active.some((s) => watches(s, fx)) || playerSubs.some((s) => followsTeam(s, fx))));
  summary.watching = live.length;

  const liveIds = new Set(live.map((f) => f.id));
  const states = new Map();
  const ids = [...liveIds];
  const stateRows = (await sb(`/rest/v1/push_fixture_state?or=(live.eq.true${ids.length ? `,fixture_id.in.(${q.ints(ids)})` : ""})&select=*&limit=500`)) || [];
  for (const r of stateRows) states.set(Number(r.fixture_id), r);

  const events = []; // { type, fx, prev }
  const toSave = [];
  for (const fx of live) {
    const prev = states.get(fx.id);
    const total = fx.gh + fx.ga;
    if (!prev) {
      if (fx.status === "1H" && (fx.elapsed ?? 99) <= 3) events.push({ type: "kickoff", fx, prev: null });
    } else {
      if (total > prev.goals_home + prev.goals_away) events.push({ type: "goal", fx, prev });
      if (fx.status === "HT" && prev.status !== "HT") events.push({ type: "half", fx, prev });
      if (prev.live === false && fx.status === "1H" && (fx.elapsed ?? 99) <= 3) events.push({ type: "kickoff", fx, prev });
    }
    toSave.push({ fixture_id: fx.id, live: true, status: fx.status, goals_home: fx.gh, goals_away: fx.ga, home_id: fx.homeId, away_id: fx.awayId, home_name: fx.home, away_name: fx.away, updated_at: new Date(now).toISOString() });
  }

  // Watched matches that were live and are no longer on the live list: read the final score.
  const gone = [...states.values()].filter((r) => r.live && !liveIds.has(Number(r.fixture_id)));
  if (gone.length) {
    const data = await football(budget, "fixtures", { ids: gone.slice(0, 20).map((r) => r.fixture_id).join("-") }, "push");
    const byId = new Map((data?.response || []).map((x) => [x.fixture?.id, flat(x)]));
    for (const r of gone) {
      const fx = byId.get(Number(r.fixture_id));
      if (fx && FINISHED.has(fx.status)) {
        events.push({ type: "full", fx, prev: r });
        toSave.push({ fixture_id: fx.id, live: false, status: fx.status, goals_home: fx.gh, goals_away: fx.ga, home_id: fx.homeId, away_id: fx.awayId, home_name: fx.home, away_name: fx.away, updated_at: new Date(now).toISOString() });
      } else if (now - new Date(r.updated_at).getTime() > 4 * 3600000) {
        toSave.push({ ...r, live: false, updated_at: new Date(now).toISOString() }); // never came back: stop tracking, no alert
      }
    }
  }
  summary.callsUsed += budget.spent;

  // State first (at most once), then send.
  if (toSave.length) await sb("/rest/v1/push_fixture_state?on_conflict=fixture_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: toSave });
  if (new Date(now).getUTCMinutes() % 20 === 0) await sb(`/rest/v1/push_fixture_state?live=eq.false&updated_at=lt.${q.iso(now - 2 * 86400000)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});

  let playerJobsNow = [];
  if (playerSubs.length) {
    const playerBudget = { calls: Math.max(1, Math.floor(num("PUSH_PLAYER_MAX_CHECKS", 6))) + 1, spent: 0 };
    try { playerJobsNow = await playerJobs(playerSubs, live, { budget: playerBudget, summary }); }
    catch (error) { summary.playerSkipped = "player check failed"; console.error("followed-player alerts failed:", error?.message || error); }
    summary.callsUsed += playerBudget.spent;
  }

  summary.events = events.length;
  const jobs = [...lineupJobsNow, ...playerJobsNow];
  for (const ev of events) {
    const msg = messageFor(ev.type, ev.fx, ev.prev);
    for (const sub of active) if (wants(sub, ev.type) && watches(sub, ev.fx)) jobs.push({ sub, msg });
  }
  await deliver(jobs, subs, summary, send);
  return summary;
}
