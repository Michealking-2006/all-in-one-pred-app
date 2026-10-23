// Structured data and address rules for clubs, players and stadiums. Used by the server-side pages for
// search engines (api/_seoPages.js) and the tests; kept out of seoCore.js so the app itself doesn't download it.
import { PAGES, NOINDEX, normalizePath } from "./seoCore.js";

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
// Which addresses are real pages (so unknown ones can be answered with a genuine 404, not a soft one)
// ---------------------------------------------------------------------------
const ENTITY_KINDS = new Set(["league", "club", "player", "venue", "match", "news"]);
export function isKnownPath(pathname) {
  const path = normalizePath(pathname);
  if (path === "/" || PAGES[path]) return true;
  const [, kind, slug, extra] = path.split("/");
  if (NOINDEX.has("/" + kind)) return true;
  if (kind === "news" && !slug) return true;
  return ENTITY_KINDS.has(kind) && !!slug && !extra;
}

// The address a page should live at, when the requested one differs only in the words (/club/42-wrong-name -> /club/42-right-name).
export function canonicalSlugPath(kind, id, name, slugify) {
  return `/${kind}/${slugify(id, name)}`;
}

