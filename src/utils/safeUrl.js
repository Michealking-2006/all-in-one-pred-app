// URLs that come from outside the app (a news provider, a remote notice, a team record) must never
// be able to run code. A link such as "javascript:alert(1)" or "data:text/html,..." in an href,
// or one hidden with tabs and line breaks ("java\nscript:"), is the classic cross-site-scripting route.
// safeUrl() returns the URL only if it is a plain web, mail or phone link or a path inside the app,
// otherwise an empty string. Pure and DOM-free, so the server uses it too (server/news.js).
const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const IMAGE_DATA = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/i; // never svg+xml: it can carry script

export function safeUrl(value, { image = false, httpsOnly = false } = {}) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw || raw.length > 2048) return "";
  if (image && (IMAGE_DATA.test(raw) || raw.startsWith("blob:"))) return raw;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return ""; // control characters have no place in a URL
  if (raw.startsWith("//")) return ""; // protocol-relative: whose site is that? be explicit
  if (raw.startsWith("/") || raw.startsWith("#") || raw.startsWith("?")) return raw; // a path inside the app
  let url;
  try { url = new URL(raw); } catch { return ""; }
  if (httpsOnly && url.protocol !== "https:") return "";
  if (!LINK_PROTOCOLS.has(url.protocol)) return "";
  if (image && url.protocol !== "http:" && url.protocol !== "https:") return "";
  return raw;
}

// For text that will be written into a URL path segment, e.g. an id from a provider.
export const safeSegment = (value) => String(value ?? "").replace(/[^A-Za-z0-9._~-]/g, "").slice(0, 80);
