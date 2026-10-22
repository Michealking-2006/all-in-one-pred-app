// Public tracked accuracy of the server-side predictions. Gives a real figure only
// once enough matches have been graded (PREDICT_MIN_PUBLISH, default 200).
import { HttpError } from "./_admin.js";
import { publicAccuracy } from "./_report.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const out = await publicAccuracy();
    res.setHeader("Vercel-CDN-Cache-Control", "max-age=600, stale-while-revalidate=3600");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return res.status(200).json(out);
  } catch (error) {
    if (error instanceof HttpError) return res.status(503).json({ error: "Accuracy is unavailable right now." });
    console.error("accuracy failed:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
