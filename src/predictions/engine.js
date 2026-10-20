// Glue between the model and the app: fetches the league table (one cached
// request per competition, shared by every match in it), runs the model, and
// records the prediction for accuracy tracking. Uses no third-party prediction
// service of any kind.
import { getStandings } from "../api/footballApi.js";
import { tableFor, predictFromTable } from "./model.js";
import { recordPrediction } from "./tracker.js";

// Resolves to a prediction, or null when the competition has no usable table
// (cup knockouts, friendlies) or a team isn't in it. Network errors reject.
// Server first: the predictions recorded before kick-off by the scheduled job are the ones that get graded,
// so the app shows exactly those. Lookups made in the same moment are sent as ONE request.
const serverCache = new Map(); // fixtureId -> prediction | null
let queue = null;

function fromServer(id) {
  if (serverCache.has(id)) return Promise.resolve(serverCache.get(id));
  if (!queue) {
    const batch = { ids: new Set(), waiters: [] };
    queue = batch;
    window.setTimeout(() => {
      queue = null;
      const ids = [...batch.ids].slice(0, 60);
      fetch("/api/predictions?fixtures=" + ids.join(","), { headers: { Accept: "application/json" } })
        .then((res) => (res.ok ? res.json() : { predictions: {} }))
        .catch(() => null) // offline or no server tracking yet: fall back to the on-device model
        .then((data) => {
          for (const fid of batch.ids) if (data) serverCache.set(fid, data.predictions?.[fid] || null);
          batch.waiters.forEach((w) => w());
        });
    }, 25);
  }
  queue.ids.add(id);
  return new Promise((resolve) => queue.waiters.push(() => resolve(serverCache.get(id) ?? null)));
}

export function predictFixture(fx, { form = {} } = {}) {
  const id = fx?.fixture?.id;
  if (!id) return Promise.resolve(null);
  return fromServer(id).then((stored) => stored || predictOnDevice(fx, { form }));
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
