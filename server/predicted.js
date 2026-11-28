// The matches Scoutwave has predicted, with everything needed to show them: GET /api/predicted?days=3
// Read straight from the predictions table, so listing the predicted matches (the VIP tab, the Slip Generator) needs no
// call to the football data service at all. Who may see a pick is decided exactly as in /api/predictions: a person with
// Premium (or who unlocked that match) gets the prediction; everyone else gets the match and a teaser, never the pick.
import { HttpError, readConfig, sb } from "../api/_admin.js";
import { ALL_NAMES } from "../api/_models.js";
import { q } from "../api/_query.js";
import { entitlementCheck, firstRows, shownPrediction } from "./predictions.js";

const START_BUFFER_MS = 5 * 60000; // a match about to start is no longer offered
const MAX_DAYS = 7, DEFAULT_DAYS = 3;
const CREST = "https://media.api-sports.io/football/";

export const asMatch = (r, shown, locked) => ({
  id: Number(r.fixture_id),
  kickoff: new Date(r.kickoff).toISOString(),
  league: { id: r.league_id, name: r.league_name || "", logo: CREST + "leagues/" + r.league_id + ".png" },
  home: { id: r.home_id, name: r.home_name || "", logo: CREST + "teams/" + r.home_id + ".png" },
  away: { id: r.away_id, name: r.away_name || "", logo: CREST + "teams/" + r.away_id + ".png" },
  ...(locked ? { locked } : { prediction: shown }),
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const asked = parseInt(String(req.query?.days ?? DEFAULT_DAYS), 10);
  const days = Math.max(1, Math.min(MAX_DAYS, Number.isInteger(asked) ? asked : DEFAULT_DAYS));
  try {
    const enforce = (await readConfig({ fresh: true })).flags.serverEntitlements === true;
    const mayView = await entitlementCheck(req, enforce);
    const now = Date.now();
    const found = (await sb(`/rest/v1/predictions?model=in.(${q.words(ALL_NAMES)})&kickoff=gte.${q.iso(now + START_BUFFER_MS)}&kickoff=lt.${q.iso(now + days * 86400000)}&status=eq.pending&select=fixture_id,model,made_at,kickoff,league_id,league_name,home_id,home_name,away_id,away_name,prediction,note,matrix&order=kickoff.asc&limit=600`)) || [];
    const rows = firstRows(found);
    const order = new Map([...rows].sort((a, b) => (b.prediction?.pickProb ?? 0) - (a.prediction?.pickProb ?? 0)).map((r, i) => [Number(r.fixture_id), i]));
    const matches = rows.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)).map((r) => {
      const id = Number(r.fixture_id);
      return mayView(id) ? asMatch(r, shownPrediction(r, order.get(id))) : asMatch(r, null, { confidence: r.prediction?.confidence || null, order: order.get(id) });
    });
    if (enforce) { res.setHeader("Cache-Control", "private, no-store"); res.setHeader("Vary", "Authorization"); }
    else { res.setHeader("Vercel-CDN-Cache-Control", "max-age=60, stale-while-revalidate=300"); res.setHeader("Cache-Control", "public, max-age=0, must-revalidate"); }
    return res.status(200).json({ matches, enforced: enforce, days });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status === 503 ? 503 : 502).json({ error: "Predictions are unavailable right now." });
    console.error("predicted failed:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
