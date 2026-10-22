// Counts football API calls per day (and what the apps report about their caches)
// for the admin Usage page. Never allowed to break or slow a real request:
// short timeout, every failure swallowed.
import { env, sb } from "./_admin.js";

const today = () => new Date().toISOString().slice(0, 10);

export async function recordUsage(source, endpoint, calls = 1, errors = 0) {
  if (!env("SUPABASE_SERVICE_ROLE_KEY")) return;
  try {
    await Promise.race([
      sb("/rest/v1/rpc/bump_usage", { method: "POST", headers: { Prefer: "return=minimal" }, body: { p_day: today(), p_source: source, p_endpoint: String(endpoint).slice(0, 60), p_calls: calls, p_errors: errors } }),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch { /* usage counting is best-effort */ }
}

export async function recordClientCache({ memory, stored, network }) {
  await sb("/rest/v1/rpc/bump_client_cache", { method: "POST", headers: { Prefer: "return=minimal" }, body: { p_day: today(), p_memory: memory, p_stored: stored, p_network: network } });
}
