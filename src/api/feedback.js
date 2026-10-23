// Support and feedback go to Formspree, which forwards each submission to the
// Scoutwave inbox. The form id is public by design (it only accepts posts).
import { APP_VERSION } from "../config.js";

export const FORMSPREE_URL = "https://formspree.io/f/xwlpozrq";
const THROTTLE_KEY = "scoutwave.support.last";
const MIN_GAP_MS = 20_000;
const TIMEOUT_MS = 15_000;

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());

function lastSent() {
  try { return Number(window.localStorage.getItem(THROTTLE_KEY)) || 0; } catch { return 0; }
}
function markSent() {
  try { window.localStorage.setItem(THROTTLE_KEY, String(Date.now())); } catch { /* storage blocked */ }
}

// Resolves on success; rejects with an Error whose message is safe to show.
export async function sendSupportMessage({ kind, message, email = "", name = "", rating = null, category = "" }) {
  const body = String(message || "").trim();
  if (body.length < 10) throw new Error("Please write a little more so we can help (at least 10 characters).");
  if (email && !isEmail(email)) throw new Error("That email address doesn't look right. Check it or leave it blank.");
  if (Date.now() - lastSent() < MIN_GAP_MS) throw new Error("Message already sent. Please wait a moment before sending another.");

  const payload = {
    _subject: `[Scoutwave ${kind}]${category ? " " + category : ""}: ${body.slice(0, 60).replace(/\s+/g, " ")}`,
    kind,
    category,
    message: body.slice(0, 5000),
    email: email.trim(),
    _replyto: email.trim() || undefined,
    name: String(name || "").trim().slice(0, 80),
    rating: rating || undefined,
    appVersion: APP_VERSION,
    page: window.location.pathname,
    language: navigator.language,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    theme: document.documentElement.dataset.theme || "",
  };

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(FORMSPREE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(error?.name === "AbortError" ? "That took too long. Please try again." : "Couldn't reach support. Check your connection and try again.");
  } finally {
    window.clearTimeout(timer);
  }

  if (response.ok) {
    markSent();
    // Also keep a copy in the admin inbox (/mingt-t). Best effort: never affects what the person sees.
    try {
      window.fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
    } catch { /* ignore */ }
    return true;
  }
  const data = await response.json().catch(() => null);
  if (response.status === 429) throw new Error("Too many messages right now. Please try again in a few minutes.");
  const detail = Array.isArray(data?.errors) ? data.errors.map((e) => e?.message).filter(Boolean).join(" ") : "";
  throw new Error(detail || "Your message couldn't be sent (error " + response.status + "). Please try again.");
}
