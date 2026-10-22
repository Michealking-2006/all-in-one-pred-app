// Sign a device up for (or out of) push alerts.
//   GET  /api/push                          -> { enabled, publicKey }
//   POST { action: "subscribe" | "update", subscription, prefs, fixtures, teams }
//   POST { action: "unsubscribe", endpoint }
// The server later sends to the saved endpoint, so only the browsers' real push
// services are accepted (never an arbitrary address).
import { HttpError, env, sb } from "./_admin.js";
import { verifyUser } from "./_account.js";
import { q } from "./_query.js";

const HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];
export function validEndpoint(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === "https:" && !u.port && String(value).length <= 700 && HOSTS.some((re) => re.test(u.hostname));
  } catch { return false; }
}
const b64url = (v) => typeof v === "string" && v.length >= 8 && v.length <= 200 && /^[A-Za-z0-9_-]+$/.test(v);
const ids = (list) => [...new Set((Array.isArray(list) ? list : []).map((n) => Math.floor(Number(n))).filter((n) => Number.isInteger(n) && n > 0 && n < 2 ** 31))].slice(0, 200);

const recent = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 5000) recent.clear();
  return list.length > 20;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const publicKey = env("VAPID_PUBLIC_KEY");
  if (req.method === "GET") return res.status(200).json({ enabled: !!(publicKey && env("VAPID_PRIVATE_KEY")), publicKey });
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const ip = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ error: "Slow down and try again in a minute." });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (body.action === "unsubscribe") {
      if (!validEndpoint(body.endpoint)) throw new HttpError(400, "Bad request");
      await sb(`/rest/v1/push_subscriptions?endpoint=eq.${q.text(body.endpoint)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return res.status(200).json({ ok: true });
    }
    if (body.action !== "subscribe" && body.action !== "update") throw new HttpError(400, "Bad request");
    if (!publicKey || !env("VAPID_PRIVATE_KEY")) throw new HttpError(503, "Push alerts aren't switched on yet.");
    const sub = body.subscription || {};
    if (!validEndpoint(sub.endpoint) || !b64url(sub.keys?.p256dh) || !b64url(sub.keys?.auth)) throw new HttpError(400, "That device can't receive alerts.");
    let userId = null;
    if (req.headers?.authorization) { try { userId = (await verifyUser(req)).id; } catch { userId = null; } } // linking to an account is optional
    const p = body.prefs || {};
    await sb("/rest/v1/push_subscriptions?on_conflict=endpoint", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_id: userId, prefs: { goals: p.goals === true, kickoff: p.kickoff === true, whistles: p.whistles === true }, fixtures: ids(body.fixtures), teams: ids(body.teams), fail_count: 0, updated_at: new Date().toISOString() },
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError) return res.status(400).json({ error: "Bad request" });
    console.error("push signup failed:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
