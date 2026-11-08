// What went wrong with a service we depend on, kept for the ADMIN only.
//
// People never see a provider's own words ("Your account is suspended", "Invalid key"): they get a plain
// "try again" message, and the proxies below return nothing but a generic body. The real reason is saved here
// (table service_errors, migration 010) and shown on the admin panel's Errors page and its "Needs attention" list.
// Best effort, like usage counting: a failure to log must never break or slow a real request.
import { env, sb } from "./_admin.js";

const today = () => new Date().toISOString().slice(0, 10);

export const KIND_LABELS = {
  banned: "Account suspended or blocked",
  key: "Key missing or rejected",
  plan: "Plan doesn't include this",
  quota: "Daily limit reached",
  rate: "Too many requests (per minute)",
  network: "No answer from the service",
  config: "Not configured",
  other: "Other error",
};

// provider answer -> { kind, text }. text is the provider's own message (admin only).
export function classifyError(errors, status) {
  const entries = Array.isArray(errors) ? errors.map((m, i) => [String(i), m]) : Object.entries(errors || {});
  const text = entries.map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join("; ").slice(0, 240);
  const keys = entries.map(([k]) => k.toLowerCase()).join(" ");
  let kind = "other";
  if (/suspend|banned|\bban\b|blocked|disabled|deactivat|inactive|terminated|account.*(expired|closed)|forbidden/i.test(text)) kind = "banned";
  else if (/plan|subscription/.test(keys) || /free plan|do not have access|upgrade|subscription|not available for your/i.test(text)) kind = "plan";
  else if (/ratelimit/.test(keys) || /too many requests|rate limit|per minute/i.test(text) || status === 429) kind = "rate";
  else if (/^requests|request/.test(keys) && /limit|reached|exceed/i.test(text)) kind = "quota";
  else if (/token|key|access/.test(keys) || status === 401 || status === 403) kind = "key";
  return { kind, text: text || (status ? `HTTP ${status}` : "no answer") };
}

// A plain-text provider message (news, AI): same kinds, from the status code and the words.
export function classifyText(message, status) {
  const text = String(message || "").slice(0, 240);
  let kind = "other";
  if (/suspend|banned|blocked|disabled|deactivat|terminated/i.test(text)) kind = "banned";
  else if (status === 402 || /insufficient|balance|quota|usage limit|daily limit|limit reached/i.test(text)) kind = "quota";
  else if (status === 429 || /rate.?limit|too many/i.test(text)) kind = "rate";
  else if (status === 401 || status === 403 || /invalid.*(key|token)|unauthori[sz]ed|api.?token/i.test(text)) kind = "key";
  return { kind, text: text || (status ? `HTTP ${status}` : "no answer") };
}

export async function recordServiceError(source, kind, endpoint, reason, status = null) {
  if (!env("SUPABASE_SERVICE_ROLE_KEY")) return;
  try {
    await Promise.race([
      sb("/rest/v1/rpc/bump_service_error", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: { p_day: today(), p_source: String(source).slice(0, 20), p_kind: String(kind).slice(0, 20), p_endpoint: String(endpoint || "-").slice(0, 60), p_reason: String(reason || "").slice(0, 400), p_status: Number.isInteger(status) ? status : null },
      }),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch { /* logging is best-effort */ }
}
