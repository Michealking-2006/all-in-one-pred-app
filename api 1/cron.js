// Scheduled jobs (see vercel.json "crons"). Vercel calls this with
//   Authorization: Bearer <CRON_SECRET>
// so set CRON_SECRET in the project's environment variables. Nobody else can run it.
//   /api/cron?task=predict   record predictions for the next two days
//   /api/cron?task=grade     grade matches that have finished
//   /api/cron?task=push      send goal / kick-off / half-time / full-time alerts (needs to run every minute, see docs/NOTIFICATIONS.md)
//   /api/cron?task=all       grade, then predict
import { HttpError, safeEqual, env } from "./_admin.js";
import { runPredict, runGrade } from "./_predict.js";
import { runPush } from "./_push.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const secret = env("CRON_SECRET");
  if (secret.length < 16) return res.status(503).json({ error: "Set CRON_SECRET (16+ characters) first." });
  const header = String(req.headers?.authorization || "");
  if (!safeEqual(header.startsWith("Bearer ") ? header.slice(7) : "", secret)) return res.status(401).json({ error: "Unauthorized" });
  const task = String(req.query?.task || "all");
  if (!["predict", "grade", "push", "all"].includes(task)) return res.status(400).json({ error: "Unknown task" });
  try {
    const out = [];
    if (task === "grade" || task === "all") out.push(await runGrade());
    if (task === "predict" || task === "all") out.push(await runPredict());
    if (task === "push") out.push(await runPush());
    console.log("cron", JSON.stringify(out));
    return res.status(200).json({ ok: true, results: out });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status >= 500 ? 500 : error.status).json({ error: error.message });
    console.error("cron failed:", error?.message || error);
    return res.status(500).json({ error: "Job failed. See the function logs." });
  }
}
