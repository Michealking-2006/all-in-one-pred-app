// Circuit breaker for the football data provider.
//
// Why: when the provider refuses us (daily limit, per-minute limit, suspended account, rejected key) the proxy used to
// carry on asking for every visitor request that wasn't already cached. Each refused call is still a call, so the
// problem fed itself. Once a refusal is seen, the proxy now stops calling the provider for a while and answers
// visitors straight away. State is kept in memory (fast) and in the api_cache table (shared between instances).
// Best effort: if the table isn't there, each instance still protects itself.
import { env, sb } from "./_admin.js";
import { q } from "./_query.js";

const KEY = "football:breaker";
const READ_MEMO_MS = 10_000;
let local = { until: 0, kind: "" };   // set by this instance
let shared = { at: 0, until: 0, kind: "" }; // last read of the shared copy

// Seconds to wait for each kind of refusal. Daily limit: until the provider's day rolls over (00:00 UTC).
export function waitFor(kind, now = Date.now()) {
  if (kind === "quota") {
    const midnight = new Date(now); midnight.setUTCHours(24, 0, 30, 0);
    return Math.max(60, Math.min(6 * 3600, Math.ceil((midnight - now) / 1000)));
  }
  if (kind === "rate") return 65;      // per-minute allowance: wait the minute out
  if (kind === "banned") return 3600;  // do not keep knocking on a suspended account
  if (kind === "key") return 1800;
  return 0;                            // plan / network / other: only that one request is affected
}

export async function tripBreaker(kind, now = Date.now()) {
  const seconds = waitFor(kind, now);
  if (!seconds) return 0;
  const until = now + seconds * 1000;
  if (until > local.until) local = { until, kind };
  if (env("SUPABASE_SERVICE_ROLE_KEY")) {
    try {
      await Promise.race([
        sb("/rest/v1/api_cache?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: [{ key: KEY, data: { until, kind }, fetched_at: new Date(now).toISOString() }] }),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch { /* optional */ }
  }
  return seconds;
}

// -> { until, kind, retryAfter } while the breaker is open, otherwise null. Never throws.
export async function breakerOpen(now = Date.now()) {
  let open = local.until > now ? local : null;
  if (!open && env("SUPABASE_SERVICE_ROLE_KEY")) {
    if (now - shared.at > READ_MEMO_MS) {
      try {
        const rows = await Promise.race([
          sb(`/rest/v1/api_cache?key=eq.${q.text(KEY)}&select=data&limit=1`),
          new Promise((resolve) => setTimeout(() => resolve(null), 1200)),
        ]);
        const d = Array.isArray(rows) ? rows[0]?.data : null;
        shared = { at: now, until: Number(d?.until) || 0, kind: String(d?.kind || "") };
      } catch { shared = { ...shared, at: now }; }
    }
    if (shared.until > now) open = shared;
  }
  return open ? { until: open.until, kind: open.kind, retryAfter: Math.max(1, Math.ceil((open.until - now) / 1000)) } : null;
}

export const resetBreaker = () => { local = { until: 0, kind: "" }; shared = { at: 0, until: 0, kind: "" }; usage = { at: 0, used: 0, limit: 0, since: 0 }; }; // tests

// Look at the day's usage BEFORE asking the provider (the status call is free). Cached for a short while per instance;
// calls made meanwhile are added on top, so a burst of match loads can't run past the floor between two checks.
// status: async () => { used, limit }. Returns the open breaker (see breakerOpen) when too little is left, else null.
let usage = { at: 0, used: 0, limit: 0, since: 0 };
export async function usageGate(status, { floor = 5, memoMs = 20_000, now = Date.now() } = {}) {
  if (now - usage.at > memoMs) {
    try { const r = await status(); usage = { at: now, used: Number(r?.used) || 0, limit: Number(r?.limit) || 0, since: 0 }; }
    catch { usage = { ...usage, at: now }; } // status unreachable: carry on with what we know, other guards still apply
  }
  usage.since++;
  if (usage.limit > 0 && usage.limit - usage.used - usage.since <= floor) {
    await tripBreaker("quota", now);
    return breakerOpen(now);
  }
  return null;
}
export const resetUsage = () => { usage = { at: 0, used: 0, limit: 0, since: 0 }; };
