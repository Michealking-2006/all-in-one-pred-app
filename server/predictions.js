// Stored predictions for the app: GET /api/predictions?fixtures=123,456 (up to 60).
// What was recorded before kick-off is what the app shows, so what people see is what gets graded.
// A match can have a row from the current model and from older ones (kept running for comparison). The app
// shows the EARLIEST row, so a pick someone has already seen never changes when the model is upgraded; when
// both were recorded in the same run, the current model wins.
//
// Who may see a pick (when the "serverEntitlements" flag is on): a signed-in person with active Premium,
// or who unlocked that match with coins. Everyone else gets only a teaser for it (how confident the
// model is, and where it ranks among the requested matches), never the pick, probabilities, score or
// reasoning. With the flag off the app runs as a demo and everything is returned.
// Market comparison and stake maths are never included.
import { HttpError, readConfig, sb } from "../api/_admin.js";
import { verifyUser, getRow, effective } from "../api/_account.js";
import { MODEL_VERSION } from "../src/predictions/model.js";
import { ALL_NAMES } from "../api/_models.js";
import { q } from "../api/_query.js";

// -> (fixtureId) => boolean
async function entitlementCheck(req, enforce) {
  if (!enforce) return () => true;
  if (!req.headers?.authorization) return () => false; // not signed in
  let user;
  try { user = await verifyUser(req); }
  catch (error) {
    // A bad or expired token, a suspended account, or the sign-in service being down: treated as signed out.
    // Failing closed is deliberate: a short outage shows a lock (the app asks again soon), never a free pick.
    if (error instanceof HttpError) return () => false;
    throw error;
  }
  const e = effective(await getRow(user.id));
  const unlocked = new Set(e.unlockedTips.map(Number));
  return (id) => e.isVip || unlocked.has(Number(id));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const ids = [...new Set(String(req.query?.fixtures || "").split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 60);
  if (!ids.length) return res.status(400).json({ error: "Pass fixtures=1,2,3" });
  try {
    const enforce = (await readConfig({ fresh: true })).flags.serverEntitlements === true; // fresh: turning the gate on must not wait for a cache
    const mayView = await entitlementCheck(req, enforce);
    const found = (await sb(`/rest/v1/predictions?model=in.(${q.words(ALL_NAMES)})&fixture_id=in.(${q.ints(ids)})&select=fixture_id,model,made_at,prediction,note`)) || [];
    const first = new Map();
    for (const r of found) {
      const id = Number(r.fixture_id), have = first.get(id);
      const earlier = !have || new Date(r.made_at) < new Date(have.made_at) || (+new Date(r.made_at) === +new Date(have.made_at) && (r.model || MODEL_VERSION) === MODEL_VERSION && (have.model || MODEL_VERSION) !== MODEL_VERSION);
      if (earlier) first.set(id, r);
    }
    const rows = [...first.values()];

    // Rank among what was asked for, strongest first: lets the app order a feed without revealing a number.
    const order = new Map([...rows].sort((a, b) => (b.prediction?.pickProb ?? 0) - (a.prediction?.pickProb ?? 0)).map((r, i) => [Number(r.fixture_id), i]));
    const predictions = {}, locked = {};
    for (const r of rows) {
      const id = Number(r.fixture_id);
      if (mayView(id)) predictions[id] = { ...r.prediction, model: r.model || MODEL_VERSION, madeAt: r.made_at, note: r.note || null, source: "server", order: order.get(id) };
      else locked[id] = { confidence: r.prediction?.confidence || null, order: order.get(id) };
    }
    if (enforce) {
      // The answer depends on who is asking: never share it between people.
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Vary", "Authorization");
    } else {
      res.setHeader("Vercel-CDN-Cache-Control", "max-age=60, stale-while-revalidate=300");
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    }
    return res.status(200).json({ predictions, locked, enforced: enforce });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status === 503 ? 503 : 502).json({ error: "Predictions are unavailable right now." });
    console.error("predictions failed:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
