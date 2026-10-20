// Start a Polar checkout for the signed-in person.
// POST { item: "premium:1m" | "premium:12m" | "coins:10" | "coins:50" | "coins:120" | "coins:300" }
// with  Authorization: Bearer <their Supabase access token>  ->  { url }
import { HttpError, readConfig } from "./_admin.js";
import { verifyUser } from "./_account.js";
import { createCheckout } from "./_polar.js";
import { siteOrigin } from "./_site.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const user = await verifyUser(req);
    const config = await readConfig({ fresh: true });
    if (config.flags.serverEntitlements !== true) throw new HttpError(403, "Account purchases are not switched on yet.");
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const item = String(body.item || "");
    const page = item.startsWith("coins:") ? "coins" : "premium";
    const url = await createCheckout({
      item,
      userId: user.id,
      email: user.email,
      successUrl: `${siteOrigin(req)}/${page}?checkout=success&checkout_id={CHECKOUT_ID}`,
    });
    return res.status(200).json({ url });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError) return res.status(400).json({ error: "Bad request" });
    console.error("checkout failed:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
