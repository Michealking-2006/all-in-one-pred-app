// Applies per-page SEO in the browser: title, description, canonical, robots,
// Open Graph / Twitter tags and JSON-LD. Pages with data (match, league) call
// setPageSeo() once it loads; everything else gets sensible defaults from the URL.
import { metaForPath, jsonLdSite, DEFAULT_DESCRIPTION, KEYWORDS, SITE_NAME } from "./seoCore.js";

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(id, data) {
  const existing = document.getElementById(id);
  if (!data) { existing?.remove(); return; }
  const el = existing || document.createElement("script");
  el.id = id;
  el.type = "application/ld+json";
  el.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(el);
}

export function setPageSeo({ title, description, noindex = false, jsonLd = null } = {}) {
  const origin = window.location.origin;
  const url = origin + window.location.pathname.replace(/\/+$/, "");
  const finalTitle = title || document.title;
  const finalDescription = description || DEFAULT_DESCRIPTION;
  document.title = finalTitle;
  upsertMeta("name", "description", finalDescription);
  upsertMeta("name", "keywords", KEYWORDS);
  upsertMeta("name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1");
  upsertLink("canonical", url || origin + "/");
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:title", finalTitle);
  upsertMeta("property", "og:description", finalDescription);
  upsertMeta("property", "og:url", url || origin + "/");
  upsertMeta("property", "og:image", origin + "/icons/icon-512.png");
  upsertMeta("name", "twitter:card", "summary");
  upsertMeta("name", "twitter:title", finalTitle);
  upsertMeta("name", "twitter:description", finalDescription);
  upsertMeta("name", "twitter:image", origin + "/icons/icon-512.png");
  setJsonLd("seo-page-jsonld", jsonLd);
}

// Called on every render: URL-derived defaults. Data-driven pages then refine it.
export function applyRouteSeo() {
  const meta = metaForPath(window.location.pathname);
  setPageSeo({ title: meta.title, description: meta.description, noindex: !!meta.noindex, jsonLd: meta.kind === "home" ? jsonLdSite(window.location.origin) : null });
}
