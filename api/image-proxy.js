// Re-serves a small allow-listed set of trusted image hosts from this app's
// own origin. Two reasons this exists rather than just using the images
// directly:
//
// 1. Canvas export (the share-image feature) needs pixel access to draw crests
//    and photos onto a <canvas>, which the browser only permits for
//    same-origin images (or cross-origin images explicitly served with a
//    permissive CORS header) — otherwise the canvas is "tainted" and
//    toBlob()/toDataURL() throw. Rather than gamble on whether
//    media.api-sports.io happens to send that header today (undocumented,
//    and could change), every image the share feature draws is fetched
//    through this same-origin endpoint instead, which sidesteps the question
//    entirely: canvas never taints on same-origin images, full stop.
// 2. It's a closed allow-list, not an open proxy: only exact, known image
//    hosts can be requested through it, so it can't be abused to fetch
//    arbitrary URLs (SSRF) via this app's server.
const ALLOWED_HOSTS = new Set(["media.api-sports.io"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB: generous for a crest/photo, not for abuse

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw = req.query?.url;
  const target = String(Array.isArray(raw) ? raw[0] : raw || "");

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: "Missing or invalid url parameter.", code: "INVALID_URL" });
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(400).json({ error: "This image host is not allowed.", code: "HOST_NOT_ALLOWED" });
  }

  try {
    const upstream = await fetch(parsed.href, { headers: { Accept: "image/*" } });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Image request failed (HTTP " + upstream.status + ").", code: "IMAGE_HTTP_ERROR" });
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return res.status(502).json({ error: "That URL did not return an image.", code: "NOT_AN_IMAGE" });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return res.status(502).json({ error: "Image too large.", code: "IMAGE_TOO_LARGE" });
    }

    // Logos and photos essentially never change once published — cache
    // aggressively both at the edge and in the browser.
    res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
    res.setHeader("Content-Type", contentType);
    // Same-origin already makes this safe for canvas; set explicitly anyway
    // as defense-in-depth (e.g. if this is ever called from another subdomain).
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Image proxy error:", error);
    return res.status(502).json({ error: "Unable to reach the image host.", code: "IMAGE_NETWORK_ERROR" });
  }
}
