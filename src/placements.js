// Pure helpers for ad / promotion spaces, shared by the app, the server and the tests.

export const PLACEMENT_SLOTS = ["news_list", "news_top", "news_inline", "news_bottom"];
export const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
export const isCampaign = (v) => typeof v === "string" && /^[a-f0-9]{8}$/.test(v);

// Is the space inside its run dates? Dates are whole days in UTC, both ends included; either end may be blank.
export function inWindow(p, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  if (p?.startsAt && today < p.startsAt) return false;
  if (p?.endsAt && today > p.endsAt) return false;
  return true;
}

// "Live", "Starts 2026-11-01", "Ended 2026-10-01", "Off": the state shown in the admin.
export function placementState(p, now = Date.now()) {
  if (!p?.on) return { state: "off", label: "Off" };
  const today = new Date(now).toISOString().slice(0, 10);
  if (p.startsAt && today < p.startsAt) return { state: "scheduled", label: "Starts " + p.startsAt };
  if (p.endsAt && today > p.endsAt) return { state: "ended", label: "Ended " + p.endsAt };
  return { state: "live", label: p.endsAt ? "Live until " + p.endsAt : "Live" };
}

// Click-through rate as a share (0..1), or null when nothing was shown.
export const ctr = (views, clicks) => (views > 0 ? clicks / views : null);
