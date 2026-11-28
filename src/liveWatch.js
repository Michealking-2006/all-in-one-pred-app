// Keeps an eye on the matches the person cares about while the app is open, wherever they are in it:
//   - starred matches feed the pinned live card (src/components/LiveCard.js)
//   - the supporter's own club feeds the goal celebration (through liveAlerts.observeFixtures)
// It asks the football service only when something can have changed (a match is live or about to start, or a few
// minutes have passed), shares the app's response cache with the Games list, and stops completely when there is
// nothing to watch. Loaded after the first screen is up, never at startup.
import { store } from "./store.js";
import { getFixturesByIds, getFixturesByDate, getFixtureEvents } from "./api/footballApi.js";
import { showToast } from "./toast.js";
import { observeFixtures } from "./liveAlerts.js";
import { isLive, localDateISO } from "./utils/fixtures.js";
import { pollMs } from "./perf.js";
import { clubFromSaved } from "./clubs.js";
import { navigate } from "./router.js";

const SOON_MS = 15 * 60 * 1000, IDLE_MS = 5 * 60 * 1000, MAX_IDS = 40;
const HIDDEN_KEY = "scoutwave.livecard.hidden";

// Is it worth asking the football service now? Pure, so it can be tested.
export function pollDue(known, now, lastFetch) {
  if (!lastFetch) return true;
  for (const fx of known.values()) {
    const st = fx?.fixture?.status?.short;
    if (isLive(st)) return true;
    if (st === "NS" || st === "TBD") { const t = Date.parse(fx.fixture?.date); if (Number.isFinite(t) && t - now < SOON_MS) return true; }
  }
  return now - lastFetch >= IDLE_MS;
}

// The live matches to pin: starred, in play, not the one already open on screen, and not hidden since its last goal.
export function pinnedRows(known, { starred, openId, hidden }) {
  const rows = [];
  for (const id of starred) {
    const fx = known.get(id);
    if (!fx || !isLive(fx.fixture?.status?.short) || id === openId) continue;
    const total = (fx.goals?.home ?? 0) + (fx.goals?.away ?? 0);
    if (hidden[id] !== undefined && total <= hidden[id]) continue; // hidden until something scores
    rows.push(fx);
  }
  return rows.sort((a, b) => (a.fixture.timestamp || 0) - (b.fixture.timestamp || 0));
}

const known = new Map();
const lastScore = new Map();
let host = null, timer = null, lastFetch = 0, busy = false, drawn = null, watchKey = ""; // drawn = null forces the next draw
let hidden = {};
try { hidden = JSON.parse(sessionStorage.getItem(HIDDEN_KEY) || "{}") || {}; } catch { hidden = {}; }

const wanted = (state) => {
  const prefs = state.notificationPrefs || {};
  const ids = (state.favorites?.match || []).slice(-MAX_IDS);
  const club = prefs.goalCelebration !== false ? clubFromSaved(state.clubTheme) : null;
  const players = prefs.players !== false && (state.favorites?.player || []).length > 0;
  return { ids: prefs.liveCard !== false ? ids : [], club, cardOn: prefs.liveCard !== false, players };
};

// Followed players: goals, assists and cards in their club's live match, as a banner while the app is open (the push
// service covers a closed app). The first look at a match only records what already happened.
const eventsSeen = new Map(); // fixtureId -> Set of event keys
async function followedPass(rows, fp, ids) {
  for (const fx of rows.filter((r) => isLive(r.fixture?.status?.short)).slice(0, 4)) {
    const events = await getFixtureEvents(fx.fixture.id).catch(() => null);
    if (!Array.isArray(events)) continue;
    const alerts = fp.followedAlerts(events, ids);
    const seenKeys = eventsSeen.get(fx.fixture.id);
    eventsSeen.set(fx.fixture.id, new Set(alerts.map((a) => a.key)));
    if (seenKeys) for (const a of alerts) if (!seenKeys.has(a.key)) showToast(fp.alertText(a), a.kind === "red" ? "error" : "success", 4500);
  }
}

async function fetchOnce() {
  const state = store.getState();
  const { ids, club, players } = wanted(state);
  const fp = players ? await import("./followedPlayers.js") : null;
  const followed = fp ? fp.playerTeams(state.favorites.player) : {};
  const teams = new Set([club?.teamId, ...Object.values(followed)].filter(Boolean));
  const rows = [];
  if (ids.length) rows.push(...(await getFixturesByIds(ids).catch(() => [])));
  const mine = [];
  if (teams.size) {
    const today = await getFixturesByDate(localDateISO(0)).catch(() => []);
    mine.push(...today.filter((fx) => teams.has(fx.teams?.home?.id) || teams.has(fx.teams?.away?.id)));
    rows.push(...mine);
  }
  if (fp && Object.keys(followed).length) await followedPass(mine.filter((fx) => Object.values(followed).some((t) => t === fx.teams?.home?.id || t === fx.teams?.away?.id)), fp, Object.keys(followed));
  for (const fx of rows) if (fx?.fixture?.id) known.set(fx.fixture.id, fx);
  observeFixtures(rows); // goals for the celebration, toasts, whistles: first sighting only records
  return rows;
}

async function tick(force = false) {
  if (busy || document.hidden) return;
  const { ids, club, players } = wanted(store.getState());
  if (!ids.length && !club && !players) return;
  if (!force && !pollDue(known, Date.now(), lastFetch)) return;
  busy = true;
  try { await fetchOnce(); lastFetch = Date.now(); } catch { /* the next tick tries again */ } finally { busy = false; }
  draw();
}

function ensureHost() {
  if (host?.isConnected) return host;
  host = document.createElement("div");
  host.id = "live-card-root";
  document.body.appendChild(host);
  return host;
}

function draw() {
  const state = store.getState();
  const { ids, cardOn } = wanted(state);
  const hideOnScreen = state.tab === "auth";
  const rows = cardOn && !hideOnScreen ? pinnedRows(known, { starred: ids, openId: state.openFixtureId || null, hidden }) : [];
  const flashIds = new Set();
  for (const fx of rows) {
    const total = (fx.goals?.home ?? 0) + (fx.goals?.away ?? 0);
    if (lastScore.has(fx.fixture.id) && lastScore.get(fx.fixture.id) !== total) flashIds.add(fx.fixture.id);
    lastScore.set(fx.fixture.id, total);
  }
  const signature = rows.map((fx) => [fx.fixture.id, fx.goals?.home, fx.goals?.away, minuteKey(fx)].join(":")).join("|");
  if (signature === drawn) return;
  drawn = signature;
  if (!rows.length && !host?.isConnected) return;
  import("./components/LiveCard.js").then((m) => {
    const count = m.drawLiveCard(ensureHost(), rows, {
      flashIds,
      onOpen: (id) => navigate(`/match/${id}`),
      onHide: () => { for (const fx of rows) hidden[fx.fixture.id] = (fx.goals?.home ?? 0) + (fx.goals?.away ?? 0); try { sessionStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden)); } catch { /* optional */ } drawn = null; draw(); },
      onMore: () => navigate("/favorites"),
    });
    const root = document.documentElement;
    if (count) { root.dataset.livecard = "1"; requestAnimationFrame(() => root.style.setProperty("--live-card-h", (host.firstElementChild?.offsetHeight || 0) + 12 + "px")); }
    else { delete root.dataset.livecard; root.style.removeProperty("--live-card-h"); }
  }).catch(() => {});
}
const minuteKey = (fx) => fx.fixture?.status?.short + (fx.fixture?.status?.elapsed || "");

function sync() {
  const state = store.getState();
  const { ids, club, cardOn, players } = wanted(state);
  const key = ids.join(",") + "|" + (club?.id || "") + "|" + cardOn + (players ? "+" + (state.favorites.player || []).join(",") : "") + "|" + state.openFixtureId + "|" + state.tab;
  if (key === watchKey) return;
  const fetchChanged = key.split("|").slice(0, 3).join("|") !== watchKey.split("|").slice(0, 3).join("|");
  watchKey = key;
  if (!ids.length && !club && !players) { window.clearInterval(timer); timer = null; known.clear(); drawn = null; draw(); return; }
  if (!timer) timer = window.setInterval(() => tick(false), pollMs(45_000));
  if (fetchChanged) tick(true); else draw();
}

export function initLiveWatch() {
  store.subscribe(sync);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(false); });
  sync();
}
