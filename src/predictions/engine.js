// Glue between the model and the app: fetches the league table (one cached
// request per competition, shared by every match in it), runs the model, and
// records the prediction for accuracy tracking. Uses no third-party prediction
// service of any kind.
import { getStandings } from "../api/footballApi.js";
import { tableFor, predictFromTable } from "./model.js";
import { recordPrediction } from "./tracker.js";
import { store } from "../store.js";
import { isFeatureOn } from "../features.js";
import { getAccessToken } from "../api/supabase.js";

// Resolves to a prediction, or null when the competition has no usable table
// (cup knockouts, friendlies) or a team isn't in it. Network errors reject.
// Server first: the predictions recorded before kick-off by the scheduled job are the ones that get graded,
// so the app shows exactly those. Lookups made in the same moment are sent as ONE request.
//
// When accounts are switched on (flag "serverEntitlements") the server decides who may see a pick: the
// answer is either the full prediction or a locked teaser { locked: true, confidence, order }. A person
// who hasn't unlocked a match never gets a pick computed on the device either (see predictFixture).
const serverCache = new Map(); // fixtureId -> { full } | { locked, at } | null
const LOCKED_REMEMBERED_MS = 30_000; // a lock may just be a hiccup (or a purchase); ask again soon
let queue = null;

// Unlocking a tip or becoming Premium changes the answers: forget the old ones.
if (typeof window !== "undefined") window.addEventListener("scoutwave:entitlements-changed", () => serverCache.clear());

let lastUser = store.getState().authUser?.id || null;
store.subscribe((s) => { const now = s.authUser?.id || null; if (now !== lastUser) { lastUser = now; serverCache.clear(); } }); // signing in or out changes who may see what

async function authHeader() {
  try { const token = await getAccessToken(); return token ? { Authorization: "Bearer " + token } : {}; } catch { return {}; }
}

function fromServer(id) {
  const have = serverCache.get(id);
  if (serverCache.has(id) && !(have?.locked && Date.now() - have.at > LOCKED_REMEMBERED_MS)) return Promise.resolve(have);
  if (!queue) {
    const batch = { ids: new Set(), waiters: [] };
    queue = batch;
    window.setTimeout(async () => {
      queue = null;
      const ids = [...batch.ids].slice(0, 60);
      let data = null;
      try {
        const res = await fetch("/api/predictions?fixtures=" + ids.join(","), { headers: { Accept: "application/json", ...(await authHeader()) }, cache: "no-store" });
        data = res.ok ? await res.json() : null;
      } catch { data = null; } // offline or no server tracking yet: fall back (see predictFixture)
      for (const fid of batch.ids) {
        if (!data) continue; // not cached: try again next time
        serverCache.set(fid, data.predictions?.[fid] ? { full: data.predictions[fid] } : data.locked?.[fid] ? { locked: data.locked[fid], at: Date.now() } : null);
      }
      batch.waiters.forEach((w) => w());
    }, 25);
  }
  queue.ids.add(id);
  return new Promise((resolve) => queue.waiters.push(() => resolve(serverCache.get(id) ?? null)));
}

// May this person see the pick for this match? Mirrors the server's rule so the screen and the server agree.
const entitled = (id) => { const s = store.getState(); return s.isVip === true || (s.unlockedMatchIds || []).includes(id); };

export function predictFixture(fx, { form = {} } = {}) {
  const id = fx?.fixture?.id;
  if (!id) return Promise.resolve(null);
  return fromServer(id).then((got) => {
    if (got?.full) return got.full;
    if (got?.locked) return { locked: true, fixtureId: id, ...got.locked };
    // The server has no stored pick (or can't be reached). With accounts on, computing one here would
    // hand it to someone who hasn't unlocked it, so only an entitled person gets the on-device estimate.
    if (isFeatureOn("serverEntitlements") && !entitled(id)) return { locked: true, fixtureId: id, confidence: null, order: 999 };
    return predictOnDevice(fx, { form });
  });
}

// Public tracked accuracy from the server (null until enough matches are graded).
export function serverAccuracy() {
  return fetch("/api/accuracy", { headers: { Accept: "application/json" } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data?.ready ? data : null))
    .catch(() => null);
}

function predictOnDevice(fx, { form = {} } = {}) {
  const leagueId = fx?.league?.id, season = fx?.league?.season;
  const homeId = fx?.teams?.home?.id, awayId = fx?.teams?.away?.id;
  if (!leagueId || !season || !homeId || !awayId) return Promise.resolve(null);
  return getStandings(leagueId, season).then((response) => {
    const rows = tableFor(response, homeId, awayId);
    const prediction = predictFromTable({ homeId, awayId, rows, form });
    if (prediction) {
      prediction.fixtureId = fx.fixture?.id;
      recordPrediction(fx, prediction);
    }
    return prediction;
  });
}

export const pickLabel = (prediction, fx) =>
  prediction.pick === "draw" ? "Draw" : (prediction.pick === "home" ? fx.teams?.home?.name : fx.teams?.away?.name) || (prediction.pick === "home" ? "Home win" : "Away win");
