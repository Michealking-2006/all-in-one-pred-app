// The signed-in person's Premium status, coins and unlocks.
// GET with  Authorization: Bearer <their Supabase access token>.
import { HttpError } from "./_admin.js";
import { verifyUser, getRow, effective } from "./_account.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const user = await verifyUser(req);
    return res.status(200).json(effective(await getRow(user.id)));
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    console.error("me failed:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
