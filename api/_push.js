// Push alerts (goals, kick-offs, half-time, full-time) for matches and clubs people
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
  return type === "goal" ? p.goals === true : type === "kickoff" ? p.kickoff === true : p.whistles === true; // half and full time
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
  if (type === "kickoff") return { type, title: "Kick-off", body: `${fx.home} v ${fx.away} has started`, tag: `fx${fx.id}-kickoff`, url };
  if (type === "half") return { type, title: "Half-time", body: score, tag: `fx${fx.id}-half`, url };
  return { type: "full", title: "Full-time", body: score, tag: `fx${fx.id}-full`, url };
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

export async function runPush({ now = Date.now(), send } = {}) {
  const summary = { job: "push", subscribers: 0, watching: 0, events: 0, sent: 0, failed: 0, removed: 0, callsUsed: 0 };
  if (!pushConfigured() && !send) { summary.skipped = "push keys are not set"; return summary; }

  const subs = (await sb("/rest/v1/push_subscriptions?select=endpoint,p256dh,auth,prefs,fixtures,teams,fail_count&limit=5000")) || [];
  summary.subscribers = subs.length;
  const active = subs.filter((s) => ["goals", "kickoff", "whistles"].some((k) => s.prefs?.[k] === true) && ((s.fixtures || []).length || (s.teams || []).length));
  if (!active.length) { summary.skipped = "nobody is watching a match"; return summary; }

  // Keep a share of today's football API quota free for the app and the other jobs.
  const quota = await footballStatus();
  const keepFree = num("PUSH_KEEP_FREE_SHARE", 0.25);
  if (!(quota.limit > 0) || quota.limit - quota.used <= quota.limit * keepFree) { summary.skipped = "football API quota is being kept free for the app"; return summary; }
  const budget = { calls: 2, spent: 0 };

  const liveData = await football(budget, "fixtures", { live: "all" }, "push");
  if (!liveData) { summary.callsUsed = budget.spent; summary.skipped = "could not read live matches"; return summary; }
  const live = (liveData.response || []).map(flat).filter((fx) => fx.id && active.some((s) => watches(s, fx)));
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
  summary.callsUsed = budget.spent;

  // State first (at most once), then send.
  if (toSave.length) await sb("/rest/v1/push_fixture_state?on_conflict=fixture_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: toSave });
  if (new Date(now).getUTCMinutes() % 20 === 0) await sb(`/rest/v1/push_fixture_state?live=eq.false&updated_at=lt.${q.iso(now - 2 * 86400000)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});

  summary.events = events.length;
  const jobs = [];
  for (const ev of events) {
    const msg = messageFor(ev.type, ev.fx, ev.prev);
    for (const sub of active) if (wants(sub, ev.type) && watches(sub, ev.fx)) jobs.push({ sub, msg });
  }
  if (!jobs.length) return summary;

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
    const sub = active.find((s) => s.endpoint === endpoint);
    const count = (sub?.fail_count || 0) + n;
    await sb(`/rest/v1/push_subscriptions?endpoint=eq.${q.text(endpoint)}`, count >= 8 ? { method: "DELETE", headers: { Prefer: "return=minimal" } } : { method: "PATCH", headers: { Prefer: "return=minimal" }, body: { fail_count: count } }).catch(() => {});
    if (count >= 8) summary.removed++;
  }
  await recordUsage("push", "sent", summary.sent, 0);
  if (summary.failed) await recordUsage("push", "failed", summary.failed, 0);
  return summary;
}
