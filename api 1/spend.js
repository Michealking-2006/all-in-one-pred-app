// Spend coins on a theme ("theme:fire") or a tip ("tip:12345"). Price and
// balance are decided here, on the server; the app only asks.
import { HttpError } from "./_admin.js";
import { verifyUser, spend, effective } from "./_account.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const user = await verifyUser(req);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { after } = await spend(user.id, body.item);
    return res.status(200).json(effective(after));
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message, ...(error.coins !== undefined ? { coins: error.coins } : {}) });
    if (error instanceof SyntaxError) return res.status(400).json({ error: "Bad request" });
    console.error("spend failed:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
