// Browsers post here when the page's Content-Security-Policy blocks something. A healthy site gets
// almost none, so a sudden count means either a deploy broke something that is now being blocked
// or something tried to inject content. Only the violated rule is counted (no URLs, no user data),
// and the numbers appear on the admin Security page.
import { recordUsage } from "../api/_usage.js";

const KNOWN = ["script-src", "style-src", "img-src", "font-src", "connect-src", "frame-src", "media-src", "worker-src", "manifest-src", "object-src", "base-uri", "form-action", "frame-ancestors", "default-src"];
const seen = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const ip = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now(), list = (seen.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now); seen.set(ip, list); if (seen.size > 5000) seen.clear();
  if (list.length > 10) return res.status(204).end(); // a noisy browser must not be able to flood the counters
  try {
    const raw = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const r = raw["csp-report"] || raw.body || (Array.isArray(raw) ? raw[0]?.body : null) || {};
    const directive = String(r["effective-directive"] || r.effectiveDirective || r["violated-directive"] || r.violatedDirective || "").split(" ")[0];
    await recordUsage("csp", KNOWN.includes(directive) ? directive : "other", 1, 0);
  } catch { /* a report that can't be read is not worth an error */ }
  return res.status(204).end();
}
