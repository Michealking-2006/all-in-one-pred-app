// Structured data and address rules for clubs, players and stadiums. Used by the server-side pages for
// search engines (api/_seoPages.js) and the tests; kept out of seoCore.js so the app itself doesn't download it.
import { PAGES, NOINDEX, SITE_NAME, normalizePath } from "./seoCore.js";

const toNumber = (v) => { const n = parseInt(String(v ?? "").replace(/[^\d.]/g, ""), 10); return Number.isFinite(n) && n > 0 ? n : null; };

export function jsonLdTeam(entry, url) {
  const t = entry?.team;
  if (!t?.name) return null;
  const v = entry.venue || {};
  return {
    "@context": "https://schema.org", "@type": "SportsTeam", "@id": url + "#team", name: t.name, url, sport: "Soccer",
    ...(t.logo ? { logo: t.logo, image: t.logo } : {}), ...(t.founded ? { foundingDate: String(t.founded) } : {}),
    ...(t.country ? { location: { "@type": "Place", name: [v.city, t.country].filter(Boolean).join(", "), address: { "@type": "PostalAddress", addressCountry: t.country, ...(v.city ? { addressLocality: v.city } : {}) } } } : {}),
  };
}

export function jsonLdPerson(profile, { team, url } = {}) {
  const p = profile;
  if (!p?.name) return null;
  const cm = toNumber(p.height), kg = toNumber(p.weight);
  return {
    "@context": "https://schema.org", "@type": "Person", "@id": url + "#person", name: p.name, url,
    ...(p.firstname ? { givenName: p.firstname } : {}), ...(p.lastname ? { familyName: p.lastname } : {}),
    jobTitle: "Football player", ...(p.photo ? { image: p.photo } : {}),
    ...(p.nationality ? { nationality: { "@type": "Country", name: p.nationality } } : {}),
    ...(p.birth?.date ? { birthDate: p.birth.date } : {}),
    ...(p.birth?.place || p.birth?.country ? { birthPlace: { "@type": "Place", name: [p.birth.place, p.birth.country].filter(Boolean).join(", ") } } : {}),
    ...(cm ? { height: { "@type": "QuantitativeValue", value: cm, unitCode: "CMT" } } : {}), ...(kg ? { weight: { "@type": "QuantitativeValue", value: kg, unitCode: "KGM" } } : {}),
    ...(team?.name ? { memberOf: { "@type": "SportsTeam", name: team.name, sport: "Soccer" } } : {}),
  };
}

export function jsonLdVenue(venue, url) {
  if (!venue?.name) return null;
  return {
    "@context": "https://schema.org", "@type": "StadiumOrArena", "@id": url + "#venue", name: venue.name, url,
    ...(venue.image ? { image: venue.image } : {}), ...(toNumber(venue.capacity) ? { maximumAttendeeCapacity: toNumber(venue.capacity) } : {}),
    address: { "@type": "PostalAddress", ...(venue.address ? { streetAddress: venue.address } : {}), ...(venue.city ? { addressLocality: venue.city } : {}), ...(venue.country ? { addressCountry: venue.country } : {}) },
  };
}

export function jsonLdItemList(name, items) {
  return { "@context": "https://schema.org", "@type": "ItemList", name, numberOfItems: items.length, itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, ...it })) };
}

// ---------------------------------------------------------------------------
// Date pages: /livescores/2026-10-29 and /predictions/2026-10-29. The window is limited on purpose, so the
// number of addresses a crawler can find stays small and every one of them has real matches behind it.
// ---------------------------------------------------------------------------
export const DAY_BACK = 30, DAY_AHEAD = 14;
export const isDaySlug = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return false;
  const t = Date.parse(s + "T00:00:00Z");
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
};
export const dayOffsetFromToday = (s, now = Date.now()) => Math.round((Date.parse(s + "T00:00:00Z") - Date.parse(new Date(now).toISOString().slice(0, 10) + "T00:00:00Z")) / 86400000);
export const dayInWindow = (s, now = Date.now()) => { if (!isDaySlug(s)) return false; const n = dayOffsetFromToday(s, now); return n >= -DAY_BACK && n <= DAY_AHEAD; };
export const prettyDay = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const shiftDay = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);


export function metaForDay(kind, day, path) {
  const nice = prettyDay(day), short = new Date(day + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const cut = (t) => (t.length <= 70 ? t : t.slice(0, 69).replace(/\s+\S*$/, "") + "\u2026");
  return kind === "livescores"
    ? { path, kind: "page", title: cut(`Football Livescores & Results for ${short} | ${SITE_NAME}`), description: `Football scores and results for ${nice}, with goals, lineups and match stats for every match.` }
    : { path, kind: "page", title: cut(`Football Predictions for ${short}: Tips & Previews | ${SITE_NAME}`), description: `Football predictions for ${nice} from our own model, with kick-off times and how confident it is in each match.` };
}

// ---------------------------------------------------------------------------
// Which addresses are real pages (so unknown ones can be answered with a genuine 404, not a soft one)
// ---------------------------------------------------------------------------
const ENTITY_KINDS = new Set(["league", "club", "player", "venue", "match", "news"]);
export function isKnownPath(pathname) {
  const path = normalizePath(pathname);
  if (path === "/" || PAGES[path]) return true;
  const [, kind, slug, extra] = path.split("/");
  if (NOINDEX.has("/" + kind)) return true;
  if ((kind === "livescores" || kind === "predictions") && slug && !extra) return dayInWindow(slug);
  if (kind === "news" && !slug) return true;
  return ENTITY_KINDS.has(kind) && !!slug && !extra;
}

// The address a page should live at, when the requested one differs only in the words (/club/42-wrong-name -> /club/42-right-name).
export function canonicalSlugPath(kind, id, name, slugify) {
  return `/${kind}/${slugify(id, name)}`;
}

export function breadcrumbs(origin, items) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: origin + path })),
  };
}
