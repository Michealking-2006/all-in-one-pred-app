// Polar (polar.sh) helpers: the product catalogue, creating a checkout, and
// verifying webhooks. The leading underscore keeps Vercel from exposing this
// file as a route.
//
// What a person gets is decided HERE from the Polar product id, never from
// anything the browser or the checkout metadata says.
import crypto from "node:crypto";
import { env, HttpError } from "./_admin.js";

// item id (what the app sends)  ->  env var holding the Polar product id, and what it grants
export const CATALOGUE = {
  "premium:1m":  { envVar: "POLAR_PRODUCT_PREMIUM_1M",  days: 30,  coins: 0,   label: "Premium, 1 month" },
  "premium:12m": { envVar: "POLAR_PRODUCT_PREMIUM_12M", days: 365, coins: 0,   label: "Premium, 12 months" },
  "coins:10":    { envVar: "POLAR_PRODUCT_COINS_10",    days: 0,   coins: 10,  label: "10 coins" },
  "coins:50":    { envVar: "POLAR_PRODUCT_COINS_50",    days: 0,   coins: 50,  label: "50 coins" },
  "coins:120":   { envVar: "POLAR_PRODUCT_COINS_120",   days: 0,   coins: 120, label: "120 coins" },
  "coins:300":   { envVar: "POLAR_PRODUCT_COINS_300",   days: 0,   coins: 300, label: "300 coins" },
};

export const productIdFor = (item) => (CATALOGUE[item] ? env(CATALOGUE[item].envVar) : "");

// Polar product id -> { item, ...grant }
export function itemForProduct(productId) {
  if (!productId) return null;
  for (const [item, entry] of Object.entries(CATALOGUE)) {
    if (env(entry.envVar) === productId) return { item, ...entry };
  }
  return null;
}

export const polarConfigured = () => !!env("POLAR_ACCESS_TOKEN");
const apiBase = () => (env("POLAR_SERVER") === "sandbox" ? "https://sandbox-api.polar.sh" : "https://api.polar.sh");

export async function createCheckout({ item, userId, email, successUrl }) {
  if (!polarConfigured()) throw new HttpError(503, "Payments are not set up yet.");
  const productId = productIdFor(item);
  if (!productId) throw new HttpError(400, "That item isn't available to buy.");
  let res;
  try {
    res = await fetch(`${apiBase()}/v1/checkouts/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("POLAR_ACCESS_TOKEN")}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        products: [productId],
        customer_email: email || undefined,
        metadata: { user_id: userId, item },
        success_url: successUrl,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new HttpError(504, "The payment provider did not respond. Try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) {
    console.error("polar checkout failed:", res.status, JSON.stringify(data)?.slice(0, 500));
    throw new HttpError(502, "Couldn't start the checkout. Try again in a moment.");
  }
  return data.url;
}

// ---------------------------------------------------------------------------
// Webhook signature (Standard Webhooks, which Polar uses).
// signed content = "<webhook-id>.<webhook-timestamp>.<raw body>", HMAC-SHA256
// with the secret's UTF-8 bytes, base64. The header may hold several
// space-separated "v1,<signature>" values.
// ---------------------------------------------------------------------------
const TOLERANCE_S = 5 * 60;

export function verifyWebhook(rawBody, headers) {
  const secret = env("POLAR_WEBHOOK_SECRET");
  if (!secret) throw new HttpError(503, "Webhook secret is not set.");
  const id = String(headers["webhook-id"] || "");
  const timestamp = String(headers["webhook-timestamp"] || "");
  const header = String(headers["webhook-signature"] || "");
  if (!id || !timestamp || !header) throw new HttpError(400, "Missing webhook headers.");
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_S) throw new HttpError(400, "Webhook timestamp is too old.");
  const expected = crypto.createHmac("sha256", Buffer.from(secret, "utf8")).update(`${id}.${timestamp}.${rawBody}`).digest();
  const ok = header.split(" ").some((part) => {
    const [version, signature] = part.split(",");
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
  if (!ok) throw new HttpError(401, "Bad webhook signature.");
  try { return JSON.parse(rawBody); } catch { throw new HttpError(400, "Bad webhook body."); }
}
