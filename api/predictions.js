// Stored predictions for the app: GET /api/predictions?fixtures=123,456 (up to 60).
// The app shows exactly what was recorded before kick-off, so what users see is
// what gets graded. Market comparison and stake maths are never included.
import { HttpError, sb } from "./_admin.js";
import { MODEL_VERSION } from "../src/predictions/model.js";
import { q } from "./_query.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const ids = [...new Set(String(req.query?.fixtures || "").split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 60);
  if (!ids.length) return res.status(400).json({ error: "Pass fixtures=1,2,3" });
  try {
    const rows = await sb(`/rest/v1/predictions?model=eq.${q.word(MODEL_VERSION)}&fixture_id=in.(${q.ints(ids)})&select=fixture_id,made_at,prediction,note`);
    const predictions = {};
    for (const r of rows || []) predictions[r.fixture_id] = { ...r.prediction, model: MODEL_VERSION, madeAt: r.made_at, note: r.note || null, source: "server" };
    res.setHeader("Vercel-CDN-Cache-Control", "max-age=60, stale-while-revalidate=300");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return res.status(200).json({ predictions });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status === 503 ? 503 : 502).json({ error: "Predictions are unavailable right now." });
    console.error("predictions failed:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
