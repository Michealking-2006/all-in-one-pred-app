// Public, read-only app configuration: feature flags, maintenance mode, the
// announcement banner, the minimum app version and theme prices. Managed from
// the admin dashboard. Cached at the edge for 30 s so it costs almost nothing.
import { readConfig, DEFAULT_CONFIG } from "./_admin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let config = DEFAULT_CONFIG;
  try {
    config = await readConfig();
  } catch (error) {
    // Never let a storage problem take the app down: fall back to the built-in defaults.
    console.error("config read failed:", error?.message || error);
  }
  // The edge (Vercel CDN) may reuse an answer for 30 s so this costs nothing, but browsers must
  // always ask again: a stale copy would delay maintenance mode or a flag change by minutes.
  res.setHeader("Vercel-CDN-Cache-Control", "max-age=30, stale-while-revalidate=300");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  return res.status(200).json(config);
}
