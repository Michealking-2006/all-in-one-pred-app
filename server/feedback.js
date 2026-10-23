// Stores a copy of every support / feedback message in the admin inbox. The app
// still sends it to Formspree (email) too; this is what lets the admin
// dashboard show, triage and track messages. Public endpoint: strictly
// validated and rate limited per IP.
import { sb, supabaseConfigured, clientIp, HttpError } from "../api/_admin.js";

const buckets = new Map(); // ip -> [timestamps]
const WINDOW_MS = 10 * 60 * 1000, MAX_PER_WINDOW = 5;

function allowed(ip, now = Date.now()) {
  const recent = (buckets.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { buckets.set(ip, recent); return false; }
  recent.push(now);
  buckets.set(ip, recent);
  if (buckets.size > 5000) buckets.clear(); // never grow without bound
  return true;
}

const text = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!supabaseConfigured()) return res.status(503).json({ error: "Inbox is not configured." });
  if (!allowed(clientIp(req))) return res.status(429).json({ error: "Too many messages. Try again later." });

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const message = text(body?.message, 5000);
  if (message.length < 10) return res.status(400).json({ error: "Message is too short." });
  const email = text(body?.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Invalid email." });
  const kind = ["issue", "feedback", "contact"].includes(body?.kind) ? body.kind : "contact";
  const rating = Number.isInteger(body?.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : null;

  try {
    await sb("/rest/v1/support_messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: {
        kind, category: text(body?.category, 60) || null, message, email: email || null, name: text(body?.name, 80) || null, rating,
        app_version: text(body?.appVersion, 20) || null, page: text(body?.page, 120) || null, user_agent: text(body?.userAgent, 300) || null,
      },
    });
    return res.status(201).json({ ok: true });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    return res.status(status === 503 ? 503 : 502).json({ error: "Could not save the message." });
  }
}

function safeJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}
