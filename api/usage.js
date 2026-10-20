// The app reports how many of its football-data lookups were answered from
// memory, from the copy saved on the device, or by asking the server. Totals only:
// no user, device or match information. Feeds the cache hit rate on the admin Usage page.
import { HttpError } from "./_admin.js";
import { recordClientCache } from "./_usage.js";

const recent = new Map(); // ip -> [timestamps]
function limited(ip) {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 5000) recent.clear();
  return list.length > 10;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const ip = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ error: "Slow down" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const n = (v) => { const x = Math.floor(Number(v)); return Number.isFinite(x) && x > 0 ? Math.min(x, 5000) : 0; }; // one report can't skew a day
    const report = { memory: n(body.memory), stored: n(body.stored), network: n(body.network) };
    if (report.memory + report.stored + report.network > 0) await recordClientCache(report);
    return res.status(204).end();
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ error: "Bad request" });
    if (error instanceof HttpError) return res.status(204).end(); // storage not set up: nothing to do
    return res.status(204).end();
  }
}
