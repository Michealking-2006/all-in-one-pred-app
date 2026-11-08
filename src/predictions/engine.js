// Glue between the app and the predictions the server has stored. The scheduled job records each prediction in the
// database before kick-off (and grades it afterwards), and the app only reads those: it never asks the football data
// service for a table or a prediction, and never computes a pick on the phone. No third-party prediction service either.
import { store } from "../store.js";
import { getAccessToken } from "../api/supabase.js";

// Resolves to the stored prediction, a locked teaser { locked: true, confidence, order } for someone who may not see
// the pick, or null when none has been recorded for that match (yet). Lookups made in the same moment are sent as ONE
// request.
//
// When accounts are switched on (flag "serverEntitlements") the server decides who may see a pick: the answer is
// either the full prediction or the locked teaser, never the pick itself.
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
      const all = [...batch.ids];
      const headers = { Accept: "application/json", ...(await authHeader()) };
      // The server answers at most 60 matches per request, so ask in chunks. (Matches past the first 60 used to be
      // remembered as "no pick" without ever being asked about.)
      for (let i = 0; i < all.length; i += 60) {
        const ids = all.slice(i, i + 60);
        let data = null;
        try {
          const res = await fetch("/api/predictions?fixtures=" + ids.join(","), { headers, cache: "no-store" });
          data = res.ok ? await res.json() : null;
        } catch { data = null; } // offline or no server tracking yet: shown as no prediction for now, asked again next time
        for (const fid of ids) {
          if (!data) continue; // not cached: try again next time
          serverCache.set(fid, data.predictions?.[fid] ? { full: data.predictions[fid] } : data.locked?.[fid] ? { locked: data.locked[fid], at: Date.now() } : null);
        }
      }
      batch.waiters.forEach((w) => w());
    }, 25);
  }
  queue.ids.add(id);
  return new Promise((resolve) => queue.waiters.push(() => resolve(serverCache.get(id) ?? null)));
}

export function predictFixture(fx) {
  const id = fx?.fixture?.id;
  if (!id) return Promise.resolve(null);
  return fromServer(id).then((got) => {
    if (got?.full) return got.full;
    if (got?.locked) return { locked: true, fixtureId: id, ...got.locked };
    return null; // nothing recorded for this match: there is nothing to show (and nothing is computed here)
  });
}

// Public tracked accuracy from the server (null until enough matches are graded).
export function serverAccuracy() {
  return fetch("/api/accuracy", { headers: { Accept: "application/json" } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data?.ready ? data : null))
    .catch(() => null);
}

export const pickLabel = (prediction, fx) =>
  prediction.pick === "draw" ? "Draw" : (prediction.pick === "home" ? fx.teams?.home?.name : fx.teams?.away?.name) || (prediction.pick === "home" ? "Home win" : "Away win");
