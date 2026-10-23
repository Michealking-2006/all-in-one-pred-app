// Polar webhook: grants Premium / coins when an order is paid, takes them back
// on a refund. Point Polar at  https://<your-domain>/api/polar-webhook  and
// subscribe it to  order.paid  and  order.refunded.
//
// Safe against repeats: each Polar order id is recorded once (payment_events),
// so a retried or duplicated delivery never grants twice.
import { HttpError, sb } from "./_admin.js";
import { isUuid, grantPurchase, reversePurchase } from "./_account.js";
import { itemForProduct, verifyWebhook } from "./_polar.js";
import { q } from "./_query.js";

// The signature covers the exact bytes Polar sent, so the body must not be parsed first.
export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new HttpError(413, "Body too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function userOf(order) {
  const fromMeta = String(order?.metadata?.user_id || "");
  const fromCustomer = String(order?.customer?.external_id || "");
  const id = fromMeta || fromCustomer;
  if (!isUuid(id)) return null;
  if (fromMeta && fromCustomer && fromMeta !== fromCustomer) return null; // disagree: don't guess
  return id;
}

async function handlePaid(order) {
  if (!order?.id) return "ignored: no order id";
  const entry = itemForProduct(order.product_id || order.product?.id);
  if (!entry) return "ignored: not a Scoutwave product";
  const userId = userOf(order);
  if (!userId) { console.error("polar order without a usable user:", order.id); return "ignored: no user"; }
  if (order.status && order.status !== "paid") return "ignored: not paid";

  // Claim the order first. If it already exists this is a repeat delivery.
  const claimed = await sb("/rest/v1/payment_events?on_conflict=order_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: { order_id: order.id, user_id: userId, product_id: order.product_id || order.product?.id, item: entry.item, grant_days: entry.days, grant_coins: entry.coins },
  });
  if (!Array.isArray(claimed) || !claimed[0]) return "already processed";
  try {
    await grantPurchase(userId, { days: entry.days, coins: entry.coins, reason: `purchase:${order.id}` });
  } catch (error) {
    // Release the claim so Polar's retry can try again.
    await sb(`/rest/v1/payment_events?order_id=eq.${q.text(order.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
    throw error;
  }
  return `granted ${entry.item}`;
}

async function handleRefunded(order) {
  if (!order?.id) return "ignored: no order id";
  const rows = await sb(`/rest/v1/payment_events?order_id=eq.${q.text(order.id)}&select=*&limit=1`);
  const event = Array.isArray(rows) ? rows[0] : null;
  if (!event) return "ignored: unknown order";
  if (event.refunded_at) return "already refunded";
  const done = await sb(`/rest/v1/payment_events?order_id=eq.${q.text(order.id)}&refunded_at=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: { refunded_at: new Date().toISOString() },
  });
  if (!Array.isArray(done) || !done[0]) return "already refunded";
  await reversePurchase(event.user_id, { days: event.grant_days, coins: event.grant_coins, reason: `refund:${order.id}` });
  return `reversed ${event.item}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const event = verifyWebhook(await readRaw(req), req.headers);
    let result = "ignored";
    if (event.type === "order.paid") result = await handlePaid(event.data);
    else if (event.type === "order.refunded") result = await handleRefunded(event.data);
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    if (error instanceof HttpError) {
      // 4xx tells Polar the request itself was wrong; 5xx makes it retry later.
      return res.status(error.status >= 500 ? 500 : error.status).json({ error: error.message });
    }
    console.error("polar webhook failed:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
