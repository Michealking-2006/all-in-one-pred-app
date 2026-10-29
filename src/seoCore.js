// SEO building blocks shared by the browser (src/seo.js) and the crawler
// pre-render on the server (api/seo.js). Pure functions: no DOM, no fetch.

export const SITE_NAME = "Scoutwave";
export const DEFAULT_TITLE = "Scoutwave: Live Football Scores, Predictions & Football Data";
export const DEFAULT_DESCRIPTION =
  "Live football scores, fixtures, league tables, lineups, match stats, odds and football data from every major competition. Scoutwave is your livescore hub for the Premier League, La Liga, Serie A, Champions League and more.";
export const KEYWORDS =
  "livescore, live football scores, football live score, soccer scores, football predictions, football data, football fixtures, league tables, match stats, lineups, football odds, Premier League, Champions League";

export const PAGES = {
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
  "/livescores": {
    title: "Livescores: Live Football Scores, Results & Fixtures | Scoutwave",
    description: "Football livescores: every live match, today's results and fixtures from the Premier League, La Liga, Serie A, Champions League and more.",
  },
  "/predictions": {
    title: "Football Predictions Today: Match Previews & Tips | Scoutwave",
    description: "Football predictions for today's matches from a model graded after every game. Match previews, model confidence and kick-off times.",
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

export const NOINDEX = new Set([
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

  if (/^(livescores|predictions)$/.test(kind) && slug) return { ...PAGES["/" + kind], path, kind: "page" };
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
    title = `${home} vs ${away} Prediction, Kick-off Time & Lineups | ${SITE_NAME}`;
    description = `${home} vs ${away} prediction and preview for the ${league}${when ? `, ${when}` : ""}. Kick-off time, form, lineups, head to head and odds.`;
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
