// Counts how often each ad / promotion space was seen and tapped, per day and campaign. Counts only: no user,
// device, address or cookie is stored. A view is reported by the app after the space has been at least half visible
// for a second (once per visit); a click when it is tapped.
//
// POST { events: [ { slot, campaign, event: "view" | "click" }, ... ] }   (up to 10)
// Only events for a space that is on, inside its run dates and still has that campaign id are counted, bots are
// ignored, and each address is limited, so the figures can't be inflated by replaying old or made-up events.
import { readConfig, sb } from "../api/_admin.js";
import { q } from "../api/_query.js";
import { PLACEMENT_SLOTS, inWindow, isCampaign } from "../src/placements.js";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|python-requests|curl|wget|httpclient/i;
const recent = new Map();
function overLimit(ip, add) {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter((t) => now - t < 60000);
  for (let i = 0; i < add; i++) list.push(now);
  recent.set(ip, list);
  if (recent.size > 5000) recent.clear();
  return list.length > 60;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  if (BOT.test(String(req.headers?.["user-agent"] || ""))) return res.status(204).end();
  const ip = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const events = (Array.isArray(body.events) ? body.events : []).slice(0, 10);
    if (!events.length || overLimit(ip, events.length)) return res.status(204).end();

    const config = await readConfig({ fresh: true }); // fresh: switching a space off or changing its dates must take effect at once
    const counts = new Map();
    for (const e of events) {
      const slot = String(e?.slot || ""), campaign = String(e?.campaign || ""), kind = String(e?.event || "");
      if (!PLACEMENT_SLOTS.includes(slot) || !isCampaign(campaign) || !["view", "click"].includes(kind)) continue;
      const p = config.placements?.[slot];
      if (!p?.on || p.campaign !== campaign || !inWindow(p)) continue; // stale, switched off or out of dates: not counted
      const key = `${slot}|${campaign}|${kind}`;
      counts.set(key, Math.min(3, (counts.get(key) || 0) + 1));
    }
    const day = new Date().toISOString().slice(0, 10);
    await Promise.all([...counts].map(([key, n]) => {
      const [slot, campaign, kind] = key.split("|");
      return sb(`/rest/v1/rpc/${q.word("bump_placement")}`, { method: "POST", headers: { Prefer: "return=minimal" }, body: { p_day: day, p_slot: slot, p_campaign: campaign, p_event: kind, p_n: n } });
    }));
  } catch { /* counting is best-effort and must never show an error to a reader */ }
  return res.status(204).end();
}
