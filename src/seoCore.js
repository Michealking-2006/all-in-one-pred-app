// SEO building blocks shared by the browser (src/seo.js) and the crawler
// pre-render on the server (api/seo.js). Pure functions: no DOM, no fetch.

export const SITE_NAME = "Scoutwave";
export const DEFAULT_TITLE = "Scoutwave: Live Football Scores, Predictions & Football Data";
export const DEFAULT_DESCRIPTION =
  "Live football scores, fixtures, league tables, lineups, match stats, odds and football data from every major competition. Scoutwave is your livescore hub for the Premier League, La Liga, Serie A, Champions League and more.";
export const KEYWORDS =
  "livescore, live football scores, football live score, soccer scores, football predictions, football data, football fixtures, league tables, match stats, lineups, football odds, Premier League, Champions League";

// Pages that are useful to index, and pages that are not (account / settings).
const PAGES = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  "/leagues": {
    title: "Football Leagues & Competitions: Tables, Fixtures, Results | Scoutwave",
    description: "Browse football leagues and cups worldwide. Live tables, fixtures, results, top scorers and football data for every competition.",
  },
  "/news": {
    title: "Football News: Latest Headlines & Transfer Stories | Scoutwave",
    description: "The latest football news: match reports, transfer stories and headlines from across the game, with links to the full stories.",
  },
  "/vip": {
    title: "Football Predictions & VIP Tips | Scoutwave",
    description: "Football predictions and VIP tips with tracked accuracy, odds comparison and match intelligence from Scoutwave.",
  },
  "/search": {
    title: "Search Football Matches, Teams, Leagues & Players | Scoutwave",
    description: "Search live football scores, teams, leagues, venues and players in one place.",
  },
  "/about": { title: "About Scoutwave: Live Football Scores & Data", description: "Scoutwave brings live football scores, predictions and football data together in one fast app." },
  "/help-centre": { title: "Help Centre | Scoutwave", description: "Answers to common questions about Scoutwave live scores, notifications, themes and Premium." },
  "/contact-us": { title: "Contact Scoutwave", description: "Get in touch with the Scoutwave team." },
  "/privacy-policy": { title: "Privacy Policy | Scoutwave", description: "How Scoutwave handles your data." },
  "/terms-of-use": { title: "Terms of Use | Scoutwave", description: "The terms for using Scoutwave." },
};

const NOINDEX = new Set([
  "/auth", "/profile", "/favorites", "/edit-profile", "/change-password", "/notifications", "/report-issue",
  "/language", "/appearance", "/feedback", "/report-issue", "/themes", "/premium", "/coins", "/avatar",
]);

// "42-manchester-united" -> "Manchester United"
export function nameFromSlug(slug) {
  const words = String(slug || "").replace(/^\d+-?/, "").split("-").filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function normalizePath(pathname) {
  const clean = String(pathname || "/").split("?")[0].split("#")[0].replace(/\/+$/g, "");
  return clean ? (clean.startsWith("/") ? clean : "/" + clean) : "/";
}

// Meta that can be known from the URL alone (no data needed).
export function metaForPath(pathname) {
  const path = normalizePath(pathname);
  const [, kind, slug] = path.split("/");
  if (PAGES[path]) return { ...PAGES[path], path, kind: path === "/" ? "home" : "page" };
  if (NOINDEX.has("/" + kind) && !slug) return { title: SITE_NAME, description: DEFAULT_DESCRIPTION, path, kind: "private", noindex: true };

  const name = nameFromSlug(slug);
  if (kind === "league" && name) {
    return { path, kind, title: `${name}: Live Scores, Table, Fixtures & Top Scorers | ${SITE_NAME}`, description: `${name} live scores, league table, fixtures, results and top scorers. Football data for ${name} updated through the season.` };
  }
  if (kind === "club" && name) {
    return { path, kind, title: `${name}: Fixtures, Results, Squad & Stats | ${SITE_NAME}`, description: `${name} latest results, upcoming fixtures, squad, form and statistics.` };
  }
  if (kind === "player" && name) {
    return { path, kind, title: `${name}: Stats, Career & Transfers | ${SITE_NAME}`, description: `${name} football statistics, career history, trophies and transfers.` };
  }
  if (kind === "venue" && name) {
    return { path, kind, title: `${name}: Stadium Info & Fixtures | ${SITE_NAME}`, description: `${name} stadium details, home teams and upcoming fixtures.` };
  }
  if (kind === "match" && slug) {
    return { path, kind, title: `Football Match Live Score, Lineups & Stats | ${SITE_NAME}`, description: "Live football score, lineups, match events, player ratings, statistics and odds." };
  }
  return { path, kind: "page", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
}

const trim = (text, max) => (text.length <= max ? text : text.slice(0, max - 1).replace(/\s+\S*$/, "") + "\u2026");
const FINISHED = new Set(["FT", "AET", "PEN"]);
const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);

function kickoffText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) + " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }) + " UTC";
}

export function metaForFixture(fx, path) {
  const home = fx?.teams?.home?.name || "Home";
  const away = fx?.teams?.away?.name || "Away";
  const status = fx?.fixture?.status?.short;
  const league = fx?.league?.name || "Football";
  const gh = fx?.goals?.home, ga = fx?.goals?.away;
  const hasScore = gh != null && ga != null;
  const when = kickoffText(fx?.fixture?.date);
  let title, description;
  if (LIVE.has(status)) {
    title = `${home} ${hasScore ? `${gh}-${ga}` : "vs"} ${away} Live Score | ${SITE_NAME}`;
    description = `${home} vs ${away} live score${hasScore ? ` (${gh}-${ga})` : ""} in the ${league}. Follow goals, lineups, player ratings and match stats as they happen.`;
  } else if (FINISHED.has(status)) {
    title = `${home} ${hasScore ? `${gh}-${ga}` : "vs"} ${away}: Final Score, Lineups & Stats | ${SITE_NAME}`;
    description = `${home} ${hasScore ? `${gh}-${ga}` : "vs"} ${away} full-time result in the ${league}${when ? ` (${when})` : ""}. Goal scorers, lineups, player ratings and match statistics.`;
  } else {
    title = `${home} vs ${away}: Kick-off Time, Lineups & Odds | ${SITE_NAME}`;
    description = `${home} vs ${away} in the ${league}${when ? `, ${when}` : ""}. Live countdown, recent form, lineups, head to head and odds.`;
  }
  return { path, kind: "match", title: trim(title, 70), description: trim(description, 300) };
}

export function metaForLeague(entry, path) {
  const name = entry?.league?.name;
  if (!name) return null;
  const country = entry?.country?.name;
  return {
    path, kind: "league",
    title: `${name}${country && country !== "World" ? ` (${country})` : ""}: Live Scores, Table, Fixtures & Top Scorers | ${SITE_NAME}`,
    description: trim(`${name} live scores, league table, fixtures by round, results, top scorers and football data${country ? ` for ${country}` : ""}.`, 300),
  };
}

export function jsonLdSite(origin, { sameAs = [] } = {}) {
  return [
    {
      "@context": "https://schema.org", "@type": "WebSite", "@id": origin + "/#website", name: SITE_NAME, url: origin + "/",
      description: DEFAULT_DESCRIPTION, inLanguage: "en", publisher: { "@id": origin + "/#organization" },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: origin + "/search?q={search_term_string}" }, "query-input": "required name=search_term_string" },
    },
    { "@context": "https://schema.org", "@type": "Organization", "@id": origin + "/#organization", name: SITE_NAME, url: origin + "/", logo: origin + "/icons/icon-512.png", ...(sameAs.length ? { sameAs } : {}) },
  ];
}

// A football match lasts about two hours including the interval; used only so the event has an end.
const endDateOf = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t + 2 * 3600000).toISOString() : ""; };

export function jsonLdFixture(fx, url) {
  if (!fx?.fixture?.id) return null;
  const status = fx.fixture?.status?.short;
  const eventStatus = status === "PST" ? "https://schema.org/EventPostponed" : status === "CANC" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled";
  const team = (t) => ({ "@type": "SportsTeam", name: t?.name || "TBD", sport: "Soccer", ...(t?.logo ? { logo: t.logo } : {}) });
  const venue = fx.fixture?.venue;
  return {
    "@context": "https://schema.org", "@type": "SportsEvent",
    name: `${fx.teams?.home?.name || "Home"} vs ${fx.teams?.away?.name || "Away"}`,
    sport: "Soccer", url, startDate: fx.fixture?.date, ...(endDateOf(fx.fixture?.date) ? { endDate: endDateOf(fx.fixture.date) } : {}), eventStatus,
    ...(fx.teams?.home?.logo ? { image: fx.teams.home.logo } : {}),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    homeTeam: team(fx.teams?.home), awayTeam: team(fx.teams?.away),
    competitor: [team(fx.teams?.home), team(fx.teams?.away)],
    ...(fx.league?.name ? { superEvent: { "@type": "SportsEvent", name: fx.league.name } } : {}),
    ...(venue?.name ? { location: { "@type": "Place", name: venue.name, address: venue.city || undefined } } : {}),
  };
}

export function breadcrumbs(origin, items) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: origin + path })),
  };
}

// ---------------------------------------------------------------------------
// Entities: clubs, players, stadiums
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Audit: what a search engine sees on a page, and what is wrong with it. Pure (works on the HTML text).
// ---------------------------------------------------------------------------
export function auditHtml(html, { canonical = "", indexable = true } = {}) {
  const issues = [];
  const add = (level, code, message) => issues.push({ level, code, message });
  const text = String(html || "");
  const grab = (re) => { const m = re.exec(text); return m ? m[1].trim() : ""; };
  const unescape = (v) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const title = unescape(grab(/<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = unescape(grab(/<meta\s+name="description"\s+content="([^"]*)"/i));
  const robots = grab(/<meta\s+name="robots"\s+content="([^"]*)"/i).toLowerCase();
  const canon = grab(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  const ogImage = grab(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
  const h1s = (text.match(/<h1[\s>]/gi) || []).length;
  const links = (text.match(/<a\s[^>]*href="\//gi) || []).length;
  const lang = grab(/<html[^>]*\slang="([^"]*)"/i);
  const bodyText = (text.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  if (!title) add("error", "title-missing", "No <title>."); else if (title.length > 65) add("warn", "title-long", `Title is ${title.length} characters; search results cut it at about 60.`); else if (title.length < 15) add("warn", "title-short", `Title is only ${title.length} characters.`);
  if (!description) add("error", "description-missing", "No meta description."); else if (description.length < 70) add("warn", "description-short", `Description is ${description.length} characters; aim for 70 to 160.`); else if (description.length > 300) add("warn", "description-long", `Description is ${description.length} characters; it will be cut.`);
  if (!canon) add("error", "canonical-missing", "No canonical link."); else {
    if (!/^https:\/\//.test(canon)) add("warn", "canonical-not-https", "The canonical link is not https (set SITE_URL).");
    if (canonical && canon !== canonical) add("error", "canonical-mismatch", `Canonical is ${canon}, expected ${canonical}.`);
  }
  const noindex = /noindex/.test(robots);
  if (indexable && noindex) add("error", "noindex-by-mistake", "This page should be indexed but says noindex.");
  if (!indexable && !noindex) add("warn", "should-be-noindex", "This private page can be indexed.");
  if (h1s === 0) add("error", "h1-missing", "No <h1> heading."); else if (h1s > 1) add("warn", "h1-many", `${h1s} <h1> headings; use one.`);
  if (!lang) add("warn", "lang-missing", "No lang attribute on <html>.");
  if (indexable && !/^https:\/\//.test(ogImage)) add("warn", "og-image", "No absolute https og:image for link previews.");
  const ld = [...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  let types = [];
  for (const m of ld) { try { const d = JSON.parse(m[1]); types.push(String(d["@type"] || "?")); if (!d["@type"]) add("warn", "ld-no-type", "A JSON-LD block has no @type."); } catch { add("error", "ld-invalid", "A JSON-LD block is not valid JSON."); } }
  if (indexable && !ld.length) add("warn", "ld-missing", "No structured data (JSON-LD).");
  if (indexable && links < 3) add("warn", "few-links", `Only ${links} internal links: crawlers need links to move on.`);
  if (indexable && bodyText.length < 200) add("warn", "thin-content", `Only ${bodyText.length} characters of readable text.`);
  return { title, description, canonical: canon, robots, h1s, links, types, textLength: bodyText.length, issues };
}
