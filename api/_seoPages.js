// The pages search engines and link-preview bots get (see api/seo.js): a small, fully rendered HTML page per
// URL with real title, description, canonical, Open Graph tags, structured data and readable content with links.
// People never see these; they get the app. Builders return
//   { meta, heading, body, jsonLd, cache? }   a page,
//   { notFound: true }                         a real 404 (the thing does not exist),
//   { redirect: "/club/42-right-name" }        a 301 to the one correct address,
//   null                                       "no data right now": the generic page is served and cached briefly.
import { metaForPath, metaForFixture, metaForLeague, jsonLdSite, jsonLdFixture, normalizePath, SITE_NAME } from "../src/seoCore.js";
import { jsonLdTeam, jsonLdPerson, jsonLdVenue, jsonLdItemList, isKnownPath, breadcrumbs, isDaySlug, dayInWindow, prettyDay, shiftDay, metaForDay, metaForLeaguePredictions } from "../src/seoEntities.js";
import { siteOrigin, esc, footballData, slugOf, currentSeasonYear, TOP_LEAGUES } from "./_site.js";
import { env, sb, supabaseConfigured } from "./_admin.js";
import { q } from "./_query.js";
import { ALL_NAMES } from "./_models.js";
import { cleanArticle } from "../server/news.js";
import { parseArticleId, isProviderId } from "../src/newsArticle.js";
import { SOCIAL_LINKS } from "../src/config.js";

const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "");
const clip = (t, n) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, "") + "\u2026");
const FINISHED = new Set(["FT", "AET", "PEN"]);

function fixtureLine(fx) {
  const h = fx.teams?.home?.name || "Home", a = fx.teams?.away?.name || "Away";
  const score = fx.goals?.home != null ? ` ${fx.goals.home}-${fx.goals.away} ` : " vs ";
  const day = fx.fixture?.date ? ` on ${new Date(fx.fixture.date).toISOString().slice(0, 10)}` : "";
  return link(`/match/${fx.fixture.id}`, `${h}${score}${a}`) + (fx.league?.name ? ` (${esc(fx.league.name)}${day})` : esc(day));
}

const letterFor = (fx, teamId) => {
  if (!FINISHED.has(fx.fixture?.status?.short) || fx.goals?.home == null) return null;
  const mine = fx.teams?.home?.id === teamId ? fx.goals.home : fx.goals.away, theirs = fx.teams?.home?.id === teamId ? fx.goals.away : fx.goals.home;
  return mine > theirs ? "W" : mine < theirs ? "L" : "D";
};

// Does the address use the one correct slug? If not, say where it should go.
const slugRedirect = (kind, id, name, requested) => (slugOf(id, name) !== requested ? { redirect: `/${kind}/${slugOf(id, name)}` } : null);

async function buildHome(origin) {
  const today = new Date().toISOString().slice(0, 10);
  const fixtures = ((await footballData("fixtures", { date: today })) || []).slice(0, 60);
  const sameAs = Object.values(SOCIAL_LINKS || {}).filter((u) => /^https:\/\//.test(u));
  return {
    jsonLd: jsonLdSite(origin, { sameAs }),
    heading: "Live football scores, predictions and football data",
    cache: 300,
    body: `<p>Live scores, fixtures, league tables, lineups, match stats and odds for the major leagues and cups, plus our own match predictions.</p>` +
      `<h2>Competitions</h2>${list(TOP_LEAGUES.map(([id, name]) => link(`/league/${slugOf(id, name)}`, name)))}` +
      (fixtures.length ? `<h2>Today's matches</h2>${list(fixtures.map(fixtureLine))}` : "") +
      `<h2>More</h2>${list([link("/livescores", "Livescores: live football scores"), link("/predictions", "Football predictions today"), link("/leagues", "All leagues"), link("/news", "Football news")])}`,
  };
}

// ---------------------------------------------------------------------------
// Livescore and prediction pages: the pages people search for by name ("livescores", "football predictions
// today"), one per day. One football API request per day (cached at the edge), one database read for predictions.
// ---------------------------------------------------------------------------
const LIVE_CODES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
const NOT_STARTED = new Set(["NS", "TBD"]);
const leagueRank = new Map(TOP_LEAGUES.map(([id], i) => [id, i]));
const hhmm = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(11, 16) + " UTC"; };
const todayUtc = () => new Date().toISOString().slice(0, 10);

function groupByLeague(fixtures) {
  const groups = new Map();
  for (const fx of fixtures) {
    const id = fx.league?.id ?? 0;
    if (!groups.has(id)) groups.set(id, { id, name: fx.league?.name || "Other competitions", country: fx.league?.country || "", fixtures: [] });
    groups.get(id).fixtures.push(fx);
  }
  const out = [...groups.values()];
  for (const g of out) g.fixtures.sort((a, b) => (a.fixture?.timestamp || 0) - (b.fixture?.timestamp || 0));
  return out.sort((a, b) => (leagueRank.get(a.id) ?? 999) - (leagueRank.get(b.id) ?? 999) || a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
}

// The earliest stored prediction per match: -> Map(fixtureId -> { confidence, pick, pickProb }). Never throws.
async function storedPredictions(ids) {
  const out = new Map();
  const list = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 400);
  if (!list.length || !supabaseConfigured()) return out;
  try {
    const rows = (await sb(`/rest/v1/predictions?model=in.(${q.words(ALL_NAMES)})&fixture_id=in.(${q.ints(list)})&select=fixture_id,made_at,prediction`)) || [];
    const made = new Map();
    for (const r of rows) {
      const id = Number(r.fixture_id), at = +new Date(r.made_at);
      if (made.has(id) && made.get(id) <= at) continue;
      made.set(id, at);
      const p = r.prediction || {};
      out.set(id, { confidence: p.confidence || null, pick: p.pick || null, pickProb: p.pickProb ?? null, safe: p.safe || null, probs: p.probs || null, likelyScore: p.likelyScore || null, over25: p.over25 ?? null });
    }
  } catch { /* predictions are an extra: the page is served without them */ }
  return out;
}

// What the public sees of a prediction. By default the whole of it, laid out like a prediction table (chances, pick,
// likely score, goals), because a page that only says "confidence: high" gives searchers and search engines nothing.
// SEO_SHOW_PICKS=0 turns it back to confidence only, if you would rather keep the picks for Premium.
const showPicks = () => env("SEO_SHOW_PICKS") !== "0";
const SIGN = { home: "1", draw: "X", away: "2" };
const SAFE_SHORT = { "1x": "1X", x2: "X2", over15: "Over 1.5", under35: "Under 3.5" };
const DASH = "\u2013";

// A prediction table for a list of fixtures: 1 = home win, X = draw, 2 = away win, with the model's chances, its
// pick, the likeliest score, the goals call, a safer pick when there is one and, once the match is over, how it went.
function predictionTable(fixtures, predictions) {
  const rows = fixtures.map((fx) => {
    const p = predictions.get(Number(fx.fixture.id)), status = fx.fixture?.status?.short;
    const over = FINISHED.has(status) && fx.goals?.home != null;
    const outcome = over ? (fx.goals.home > fx.goals.away ? "home" : fx.goals.home < fx.goals.away ? "away" : "draw") : null;
    const result = over ? `${fx.goals.home}-${fx.goals.away}${p?.pick ? (outcome === p.pick ? " (pick correct)" : " (pick missed)") : ""}` : LIVE_CODES.has(status) ? "live" : "";
    const c = (v) => `<td>${v}</td>`;
    const name = `${fx.teams?.home?.name || "Home"} vs ${fx.teams?.away?.name || "Away"}`;
    const goals = p?.over25 == null ? DASH : `${p.over25 >= 50 ? "Over" : "Under"} 2.5 (${Math.max(p.over25, 100 - p.over25)}%)`;
    return `<tr><th scope="row">${link(`/match/${fx.fixture.id}`, name)}</th>${c(NOT_STARTED.has(status) || LIVE_CODES.has(status) ? hhmm(fx.fixture.date) : DASH)}` +
      `${["home", "draw", "away"].map((k) => c(p?.probs ? esc(p.probs[k]) + "%" : DASH)).join("")}` +
      `${c(p?.pick ? esc(SIGN[p.pick]) : DASH)}${c(p?.likelyScore ? `${esc(p.likelyScore.home)}-${esc(p.likelyScore.away)}` : DASH)}${c(esc(goals))}` +
      `${c(p?.safe && SAFE_SHORT[p.safe.market] ? `${SAFE_SHORT[p.safe.market]} (${esc(p.safe.prob)}%)` : DASH)}${c(esc(result) || DASH)}</tr>`;
  }).join("");
  return `<table><thead><tr><th>Match</th><th>Kick-off</th><th>1</th><th>X</th><th>2</th><th>Pick</th><th>Score</th><th>Goals</th><th>Safer pick</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
}
const LEGEND = "<p>1 is a home win, X a draw and 2 an away win. The percentages are the model's chances; Score is its likeliest result.</p>";
function predictionText(fx, stored) {
  if (!stored) return "";
  const home = fx.teams?.home?.name || "Home", away = fx.teams?.away?.name || "Away";
  const level = stored.confidence ? `Model confidence: ${esc(stored.confidence)}.` : "";
  if (!showPicks() || !stored.pick) return level;
  const safe = stored.safe ? ` Safer pick: ${stored.safe.market === "1x" ? `${esc(home)} or draw` : stored.safe.market === "x2" ? `${esc(away)} or draw` : stored.safe.market === "over15" ? "over 1.5 goals" : "under 3.5 goals"} (${esc(stored.safe.prob)}%).` : "";
  const label = stored.pick === "draw" ? "a draw" : `${esc(stored.pick === "home" ? home : away)} to win`;
  return `Most likely result: ${label}${stored.pickProb != null ? ` (${esc(Math.round(stored.pickProb))}%)` : ""}.${stored.likelyScore ? ` Likely score ${esc(stored.likelyScore.home)}-${esc(stored.likelyScore.away)}.` : ""} ${level}${safe}`.trim();
}

async function buildDay(kind, day, path, origin, requestedPlain) {
  const rows = await footballData("fixtures", { date: day });
  if (rows === null) return null;
  const fixtures = rows.filter((fx) => fx?.fixture?.id).slice(0, 400);
  const nice = prettyDay(day);
  const groups = groupByLeague(fixtures);
  const live = fixtures.filter((fx) => LIVE_CODES.has(fx.fixture?.status?.short)).length;
  const done = fixtures.filter((fx) => FINISHED.has(fx.fixture?.status?.short)).length;
  const upcoming = fixtures.filter((fx) => NOT_STARTED.has(fx.fixture?.status?.short)).length;
  const predictions = kind === "predictions" ? await storedPredictions(fixtures.map((fx) => fx.fixture.id)) : new Map();
  const sister = kind === "livescores" ? "predictions" : "livescores";
  const base = `/${kind}`, sisterBase = `/${sister}`;
  const dayPath = (d) => (d === todayUtc() ? base : `${base}/${d}`);
  const navLinks = [-1, 1].map((n) => shiftDay(day, n)).filter((d) => dayInWindow(d)).map((d) => link(dayPath(d), `${kind === "livescores" ? "Livescores" : "Predictions"} ${n_label(d, day)}`));
  const sisterPath = day === todayUtc() ? sisterBase : `${sisterBase}/${day}`;

  const summary = fixtures.length
    ? `${nice}: ${fixtures.length} ${fixtures.length === 1 ? "match" : "matches"} in ${groups.length} ${groups.length === 1 ? "competition" : "competitions"}` +
      `${live ? `, ${live} live now` : ""}${done ? `, ${done} finished` : ""}${upcoming ? `, ${upcoming} still to play` : ""}.`
    : `No matches are listed for ${nice}.`;
  const intro = kind === "livescores"
    ? `<p>${esc(summary)} Open a match for its goals, lineups, player ratings and stats.</p>`
    : `<p>${esc(summary)} Each prediction is saved before kick-off and checked against the final score, so anyone can see how the model did. They are estimates, not betting advice.</p>`;

  const sections = groups.map((g) => {
    const items = g.fixtures.map((fx) => {
      const status = fx.fixture?.status?.short;
      const homeName = fx.teams?.home?.name || "Home", awayName = fx.teams?.away?.name || "Away";
      const score = fx.goals?.home != null && fx.goals?.away != null ? ` ${fx.goals.home}-${fx.goals.away} ` : " vs ";
      const when = NOT_STARTED.has(status) ? `kick-off ${hhmm(fx.fixture.date)}` : LIVE_CODES.has(status) ? `live${fx.fixture?.status?.elapsed ? ` ${esc(fx.fixture.status.elapsed)}'` : ""}` : esc(fx.fixture?.status?.long || status || "");
      const extra = kind === "predictions" ? predictionText(fx, predictions.get(Number(fx.fixture.id))) : "";
      return `${link(`/match/${fx.fixture.id}`, `${homeName}${score}${awayName}`)}${kind === "predictions" && NOT_STARTED.has(status) ? " prediction" : ""} (${when})${extra ? ` ${extra}` : ""}`;
    });
    const heading = `${g.id ? link(`/league/${slugOf(g.id, g.name)}`, g.name) : esc(g.name)}${g.country && g.country !== "World" ? ` (${esc(g.country)})` : ""}`;
    return `<h2>${heading}</h2>${kind === "predictions" && showPicks() ? predictionTable(g.fixtures, predictions) : list(items)}`;
  }).join("");

  const title = kind === "livescores" ? `Football livescores${day === todayUtc() ? " today" : ""}: ${nice}` : `Football predictions${day === todayUtc() ? " today" : ""}: ${nice}`;
  const itemList = fixtures.slice(0, 50).map((fx) => ({ name: `${fx.teams?.home?.name || "Home"} vs ${fx.teams?.away?.name || "Away"}`, url: `${origin}/match/${fx.fixture.id}` }));
  const label = kind === "livescores" ? "Livescores" : "Predictions";
  const date = isDaySlug(requestedPlain) ? requestedPlain : null;
  return {
    meta: date ? metaForDay(kind, date, path) : metaForPath(base),
    heading: title,
    cache: day === todayUtc() ? 120 : day < todayUtc() ? 21600 : 900,
    jsonLd: [breadcrumbs(origin, [["Home", "/"], [label, base], ...(date ? [[nice, path]] : [])]), itemList.length ? jsonLdItemList(`${label} ${nice}`, itemList) : null],
    body: intro + (kind === "predictions" && showPicks() && fixtures.length ? LEGEND : "") + sections +
      `<h2>More</h2>${list([...navLinks, link(sisterPath, `${sister === "predictions" ? "Football predictions" : "Livescores"} for ${day === todayUtc() ? "today" : nice}`), link("/leagues", "All leagues"), link("/news", "Football news")])}`,
  };
}
function n_label(d, from) { return d > from ? "tomorrow's page: " + prettyDay(d) : "the day before: " + prettyDay(d); }

// "Premier League predictions": the next matches of one competition, each with the model's confidence.
async function buildLeaguePredictions(id, path, origin, requested) {
  const known = TOP_LEAGUES.find(([lid]) => lid === id);
  if (!known) return { notFound: true };
  const moved = slugRedirect("predictions", id, known[1], requested);
  if (moved) return moved;
  const entry = ((await footballData("leagues", { id })) || [])[0];
  const season = (entry?.seasons || []).find((s) => s.current)?.year || currentSeasonYear();
  const rows = await footballData("fixtures", { league: id, season, next: 12 });
  if (rows === null) return null;
  const fixtures = rows.filter((fx) => fx?.fixture?.id && NOT_STARTED.has(fx.fixture?.status?.short));
  const name = known[1], meta = metaForLeaguePredictions(name, path);
  const predictions = await storedPredictions(fixtures.map((fx) => fx.fixture.id));
  const items = fixtures.map((fx) => {
    const day = new Date(fx.fixture.date).toISOString().slice(0, 10);
    const extra = predictionText(fx, predictions.get(Number(fx.fixture.id)));
    return `${link(`/match/${fx.fixture.id}`, `${fx.teams?.home?.name || "Home"} vs ${fx.teams?.away?.name || "Away"} prediction`)} (${esc(prettyDay(day))}, kick-off ${hhmm(fx.fixture.date)})${extra ? ` ${extra}` : ""}`;
  });
  return {
    meta, heading: `${name} predictions`, cache: 1800,
    jsonLd: [breadcrumbs(origin, [["Home", "/"], ["Predictions", "/predictions"], [name, path]]), fixtures.length ? jsonLdItemList(`${name} predictions`, fixtures.map((fx) => ({ name: `${fx.teams?.home?.name || "Home"} vs ${fx.teams?.away?.name || "Away"}`, url: `${origin}/match/${fx.fixture.id}` }))) : null],
    body: `<p>${esc(fixtures.length ? `The next ${fixtures.length} ${name} ${fixtures.length === 1 ? "match" : "matches"}, each with a prediction from our own model that is saved before kick-off and checked against the final score. Predictions are estimates, not betting advice.` : `There are no upcoming ${name} matches listed right now. Check back closer to the next round.`)}</p>` +
      (items.length ? `<h2>Upcoming matches</h2>${showPicks() ? LEGEND + predictionTable(fixtures, predictions) : list(items)}` : "") +
      `<h2>More</h2>${list([link(`/league/${slugOf(id, name)}`, `${name} table, fixtures and results`), link("/predictions", "Football predictions today"), ...TOP_LEAGUES.filter(([lid]) => lid !== id).slice(0, 8).map(([lid, n]) => link(`/predictions/${slugOf(lid, n)}`, `${n} predictions`))])}`,
  };
}

async function buildMatch(id, path, origin) {
  const rows = await footballData("fixtures", { id });
  if (rows === null) return null;
  const fx = rows[0];
  if (!fx) return { notFound: true };
  const meta = { ...metaForFixture(fx, path), image: fx.teams?.home?.logo || "" };
  const home = fx.teams?.home, away = fx.teams?.away;
  const goals = (fx.events || []).filter((e) => String(e.type).toLowerCase() === "goal" && !/missed/i.test(e.detail || ""));
  const live = !FINISHED.has(fx.fixture?.status?.short) && fx.fixture?.status?.short !== "NS" && fx.fixture?.status?.short !== "TBD";
  const upcoming = NOT_STARTED.has(fx.fixture?.status?.short);
  const matchDay = fx.fixture?.date ? new Date(fx.fixture.date).toISOString().slice(0, 10) : "";
  const stored = upcoming ? (await storedPredictions([id])).get(Number(id)) : null;
  const dayLinks = matchDay && dayInWindow(matchDay) ? [link(`/predictions/${matchDay}`, `Football predictions for ${prettyDay(matchDay)}`), link(`/livescores/${matchDay}`, `Livescores for ${prettyDay(matchDay)}`)] : [link("/predictions", "Football predictions"), link("/livescores", "Livescores")];
  return {
    meta, cache: live ? 60 : FINISHED.has(fx.fixture?.status?.short) ? 3600 : 600,
    jsonLd: [jsonLdFixture(fx, origin + path), breadcrumbs(origin, [["Home", "/"], [fx.league?.name || "Football", fx.league?.id ? `/league/${slugOf(fx.league.id, fx.league.name)}` : "/leagues"], [`${home?.name} vs ${away?.name}`, path]])],
    heading: `${home?.name || "Home"} vs ${away?.name || "Away"}`,
    body: `<p>${esc(meta.description)}</p>` +
      `<p>Status: ${esc(fx.fixture?.status?.long || "")}${fx.goals?.home != null ? `. Score: ${fx.goals.home}-${fx.goals.away}` : ""}</p>` +
      list([
        fx.league?.name ? `Competition: ${link(`/league/${slugOf(fx.league.id, fx.league.name)}`, fx.league.name)}${fx.league.round ? ", " + esc(fx.league.round) : ""}` : "",
        fx.fixture?.venue?.name ? `Venue: ${esc(fx.fixture.venue.name)}${fx.fixture.venue.city ? ", " + esc(fx.fixture.venue.city) : ""}` : "",
        fx.fixture?.referee ? `Referee: ${esc(fx.fixture.referee)}` : "",
        home?.id ? link(`/club/${slugOf(home.id, home.name)}`, home.name) : "",
        away?.id ? link(`/club/${slugOf(away.id, away.name)}`, away.name) : "",
      ].filter(Boolean)) +
      (goals.length ? `<h2>Goals</h2>${list(goals.map((e) => `${esc(e.time?.elapsed)}' ${esc(e.player?.name)} (${esc(e.team?.name)})`))}` : "") +
      (upcoming ? `<h2>${esc(home?.name || "Home")} vs ${esc(away?.name || "Away")} prediction</h2><p>${esc(home?.name || "Home")} host ${esc(away?.name || "Away")} in the ${esc(fx.league?.name || "match")}${fx.fixture?.date ? `, kick-off ${esc(hhmm(fx.fixture.date))}` : ""}. ${predictionText(fx, stored) || "Our model saves its prediction before kick-off and checks it against the result afterwards."}</p>` : "") +
      `<h2>More</h2>${list(dayLinks)}`,
  };
}

async function buildLeague(id, path, origin, requested) {
  const rows = await footballData("leagues", { id });
  if (rows === null) return null;
  const entry = rows[0];
  if (!entry?.league?.name) return { notFound: true };
  const moved = slugRedirect("league", id, entry.league.name, requested);
  if (moved) return moved;
  const meta = { ...metaForLeague(entry, path), image: entry.league.logo || "" };
  const season = (entry.seasons || []).find((s) => s.current)?.year || (entry.seasons || []).slice(-1)[0]?.year;
  const table = season ? ((((await footballData("standings", { league: id, season })) || [])[0]?.league?.standings || [])[0] || []) : [];
  const teams = table.slice(0, 24);
  return {
    meta, cache: 3600,
    jsonLd: [breadcrumbs(origin, [["Home", "/"], ["Leagues", "/leagues"], [entry.league.name, path]]), teams.length ? jsonLdItemList(`${entry.league.name} table${season ? " " + season : ""}`, teams.map((r) => ({ name: r.team.name, url: `${origin}/club/${slugOf(r.team.id, r.team.name)}` }))) : null],
    heading: entry.league.name,
    body: `<p>${esc(meta.description)}</p>` +
      (teams.length ? `<h2>League table${season ? ` ${esc(season)}` : ""}</h2><ol>${teams.map((r) => `<li>${link(`/club/${slugOf(r.team.id, r.team.name)}`, r.team.name)}: ${esc(r.points)} pts from ${esc(r.all?.played)} games (${esc(r.all?.win)}W ${esc(r.all?.draw)}D ${esc(r.all?.lose)}L, goal difference ${esc(r.goalsDiff)})</li>`).join("")}</ol>` : "") +
      list([link("/leagues", "All leagues"), link("/", "Live scores")]),
  };
}

async function buildClub(id, path, origin, requested) {
  const rows = await footballData("teams", { id });
  if (rows === null) return null;
  const entry = rows[0];
  if (!entry?.team?.name) return { notFound: true };
  const moved = slugRedirect("club", id, entry.team.name, requested);
  if (moved) return moved;
  const t = entry.team, v = entry.venue || {};
  const [last, next] = await Promise.all([footballData("fixtures", { team: id, last: 5 }), footballData("fixtures", { team: id, next: 5 })]);
  const recent = (last || []).slice().sort((a, b) => (a.fixture.timestamp || 0) - (b.fixture.timestamp || 0));
  const form = recent.map((fx) => letterFor(fx, Number(id))).filter(Boolean).join("");
  const description = clip(`${t.name}${t.country ? ` (${t.country})` : ""}: latest results, upcoming fixtures, squad and statistics.` + (t.founded ? ` Founded in ${t.founded}` : "") + (v.name ? `${t.founded ? "," : " "} plays at ${v.name}${v.city ? ", " + v.city : ""}.` : t.founded ? "." : "") + (form ? ` Recent form: ${form}.` : ""), 300);
  const meta = { path, kind: "club", title: clip(`${t.name}: Fixtures, Results, Squad & Stats | ${SITE_NAME}`, 70), description, image: t.logo || "" };
  return {
    meta, cache: 21600,
    jsonLd: [jsonLdTeam(entry, origin + path), breadcrumbs(origin, [["Home", "/"], ["Clubs", "/leagues"], [t.name, path]])],
    heading: t.name,
    body: `<p>${esc(description)}</p>` +
      `<h2>Club facts</h2>${list([t.country ? `Country: ${esc(t.country)}` : "", t.founded ? `Founded: ${esc(t.founded)}` : "", t.code ? `Short name: ${esc(t.code)}` : "", v.name ? `Stadium: ${v.id ? link(`/venue/${slugOf(v.id, v.name)}`, v.name) : esc(v.name)}${v.capacity ? `, capacity ${esc(v.capacity)}` : ""}${v.city ? `, ${esc(v.city)}` : ""}` : ""].filter(Boolean))}` +
      (recent.length ? `<h2>Recent results</h2>${list(recent.slice().reverse().map(fixtureLine))}` : "") +
      ((next || []).length ? `<h2>Upcoming fixtures</h2>${list(next.map(fixtureLine))}` : "") +
      `<h2>More</h2>${list([link("/leagues", "All leagues"), link("/", "Live scores")])}`,
  };
}

async function buildPlayer(id, path, origin, requested) {
  const profileRows = await footballData("players/profiles", { player: id });
  if (profileRows === null) return null;
  const p = profileRows[0]?.player;
  if (!p?.name) return { notFound: true };
  const moved = slugRedirect("player", id, p.name, requested);
  if (moved) return moved;
  const season = currentSeasonYear();
  const statRows = (await footballData("players", { id, season })) || [];
  const stats = statRows[0]?.statistics || [];
  const club = stats[0]?.team;
  const sum = (f) => stats.reduce((t, s) => t + (Number(f(s)) || 0), 0);
  const goals = sum((s) => s.goals?.total), assists = sum((s) => s.goals?.assists), apps = sum((s) => s.games?.appearences);
  const position = String(stats[0]?.games?.position || p.position || "").toLowerCase();
  const description = clip(`${p.name}${p.age ? `, ${p.age}` : ""}${p.nationality ? `, ${p.nationality}` : ""}${position ? ` ${position}` : " footballer"}${club?.name ? ` for ${club.name}` : ""}.` + (apps ? ` ${season}/${String(season + 1).slice(2)}: ${apps} appearances, ${goals} goals, ${assists} assists.` : "") + " Career statistics, trophies and transfers.", 300);
  const meta = { path, kind: "player", title: clip(`${p.name}: Stats, Career & Transfers | ${SITE_NAME}`, 70), description, image: p.photo || "" };
  return {
    meta, cache: 21600,
    jsonLd: [jsonLdPerson(p, { team: club, url: origin + path }), breadcrumbs(origin, [["Home", "/"], ["Players", "/search"], [p.name, path]])],
    heading: p.name,
    body: `<p>${esc(description)}</p>` +
      `<h2>Player facts</h2>${list([p.nationality ? `Nationality: ${esc(p.nationality)}` : "", p.age ? `Age: ${esc(p.age)}` : "", p.birth?.date ? `Born: ${esc(p.birth.date)}${p.birth.place ? ", " + esc(p.birth.place) : ""}` : "", p.height ? `Height: ${esc(p.height)}` : "", p.weight ? `Weight: ${esc(p.weight)}` : "", p.number ? `Shirt number: ${esc(p.number)}` : "", position ? `Position: ${esc(position)}` : "", club?.name ? `Club: ${club.id ? link(`/club/${slugOf(club.id, club.name)}`, club.name) : esc(club.name)}` : ""].filter(Boolean))}` +
      (apps ? `<h2>Season ${esc(season)}/${esc(String(season + 1).slice(2))}</h2>${list([`Appearances: ${apps}`, `Goals: ${goals}`, `Assists: ${assists}`])}` : "") +
      list([link("/search", "Search players"), link("/", "Live scores")]),
  };
}

async function buildVenue(id, path, origin, requested) {
  const rows = await footballData("venues", { id });
  if (rows === null) return null;
  const v = rows[0];
  if (!v?.name) return { notFound: true };
  const moved = slugRedirect("venue", id, v.name, requested);
  if (moved) return moved;
  const description = clip(`${v.name}${v.city ? `, ${v.city}` : ""}${v.country ? ` (${v.country})` : ""}: football stadium` + (v.capacity ? ` with a capacity of ${Number(v.capacity).toLocaleString("en-GB")}` : "") + (v.surface ? ` and a ${String(v.surface).toLowerCase()} pitch` : "") + ". Home teams and upcoming fixtures.", 300);
  const meta = { path, kind: "venue", title: clip(`${v.name}: Stadium Info & Fixtures | ${SITE_NAME}`, 70), description, image: v.image || "" };
  return {
    meta, cache: 86400,
    jsonLd: [jsonLdVenue(v, origin + path), breadcrumbs(origin, [["Home", "/"], ["Venues", "/search"], [v.name, path]])],
    heading: v.name,
    body: `<p>${esc(description)}</p>` + list([v.address ? `Address: ${esc(v.address)}` : "", v.city ? `City: ${esc(v.city)}` : "", v.country ? `Country: ${esc(v.country)}` : "", v.capacity ? `Capacity: ${esc(v.capacity)}` : "", v.surface ? `Surface: ${esc(v.surface)}` : ""].filter(Boolean)) + list([link("/leagues", "All leagues"), link("/", "Live scores")]),
  };
}

// A news story: the headline, the publisher's summary and a link to the full story.
async function buildArticle(id, path, origin) {
  const token = String(process.env.NEWS_ACCESS || "").trim();
  if (!token || !isProviderId(id)) return isProviderId(id) ? null : { notFound: true };
  const r = await fetch(`https://api.thenewsapi.com/v1/news/uuid/${id}?` + new URLSearchParams({ api_token: token }), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
  if (r.status === 404) return { notFound: true };
  const article = r.ok ? cleanArticle(await r.json().catch(() => null)) : null;
  if (!article) return null;
  const description = clip(article.description || article.title, 300);
  return {
    meta: { path, kind: "article", title: clip(article.title, 62) + " | " + SITE_NAME, description, image: article.image || "" },
    heading: article.title, cache: 21600,
    jsonLd: [{ "@context": "https://schema.org", "@type": "NewsArticle", headline: clip(article.title, 110), ...(article.image ? { image: [article.image] } : {}), ...(article.publishedAt ? { datePublished: article.publishedAt, dateModified: article.publishedAt } : {}), author: { "@type": "Organization", name: article.source || "Publisher" }, publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: origin + "/icons/icon-512.png" } }, mainEntityOfPage: origin + path }, breadcrumbs(origin, [["Home", "/"], ["News", "/news"], [clip(article.title, 60), path]])],
    body: `<p>${esc(description)}</p>${article.source ? `<p>Source: ${esc(article.source)}</p>` : ""}<p><a href="${esc(article.url)}" rel="noopener nofollow">Read the full story${article.source ? " on " + esc(article.source) : ""}</a></p>${list([link("/news", "More football news")])}`,
  };
}

// ---------------------------------------------------------------------------
function shell({ meta, heading, body, jsonLd, origin, path, status = 200 }) {
  const url = origin + (path === "/" ? "/" : path);
  const hasImage = meta.image && /^https:\/\//.test(meta.image);
  const image = hasImage ? meta.image : origin + "/icons/og-image.png";
  const noindex = meta.noindex || status === 404;
  const verify = [["google-site-verification", env("GOOGLE_SITE_VERIFICATION")], ["msvalidate.01", env("BING_SITE_VERIFICATION")]].filter(([, v]) => v);
  const twitter = env("TWITTER_SITE").replace(/^@?/, "@");
  const big = !hasImage || (meta.kind === "article" && hasImage);
  const m = (attr, k, v) => `<meta ${attr}="${k}" content="${esc(v)}">`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
${m("name", "description", meta.description)}
${m("name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1")}
${status === 404 ? "" : `<link rel="canonical" href="${esc(url)}">`}
<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} football news" href="${esc(origin)}/feed.xml">
${verify.map(([k, v]) => m("name", k, v)).join("\n")}
${m("property", "og:site_name", SITE_NAME)}${m("property", "og:locale", "en_GB")}${m("property", "og:type", meta.kind === "article" ? "article" : "website")}
${m("property", "og:title", meta.title)}${m("property", "og:description", meta.description)}
${m("property", "og:url", url)}${m("property", "og:image", image)}${m("property", "og:image:alt", heading || meta.title)}
${hasImage ? "" : m("property", "og:image:width", "1200") + m("property", "og:image:height", "630")}
${m("name", "twitter:card", big ? "summary_large_image" : "summary")}${m("name", "twitter:title", meta.title)}${m("name", "twitter:description", meta.description)}${m("name", "twitter:image", image)}
${twitter.length > 1 ? m("name", "twitter:site", twitter) : ""}
${m("name", "theme-color", "#d50000")}
${(jsonLd || []).filter(Boolean).map((data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")}</script>`).join("\n")}
</head><body>
<header><a href="/">${SITE_NAME}</a> <nav>${link("/livescores", "Livescores")} ${link("/predictions", "Predictions")} ${link("/leagues", "Leagues")} ${link("/news", "News")}</nav></header>
<main><h1>${esc(heading)}</h1>${body}</main>
<footer>${link("/about", "About")} ${link("/privacy-policy", "Privacy")} ${link("/terms-of-use", "Terms")} ${link("/contact-us", "Contact")}</footer>
</body></html>`;
}

// -> { status, headers, html } for one address. Never throws.
export async function renderPage(rawPath, origin) {
  const path = normalizePath(rawPath || "/");
  const [, kind, slug] = path.split("/");
  const html = (args) => shell({ origin, path, ...args });

  if (!isKnownPath(path)) {
    const meta = { title: `Page not found | ${SITE_NAME}`, description: "That page doesn't exist. Try live scores, leagues or football news.", noindex: true, path, kind: "page" };
    return { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" }, html: html({ meta, heading: "Page not found", body: `<p>${esc(meta.description)}</p>${list([link("/", "Live scores"), link("/leagues", "Leagues"), link("/news", "News")])}`, status: 404 }) };
  }

  // /vip is the in-app name of the predictions screen; search engines get one address for it.
  if (path === "/vip") return { status: 301, headers: { Location: origin + "/predictions", "Cache-Control": "public, s-maxage=86400" }, html: "" };

  let meta = metaForPath(path);
  let jsonLd = [];
  let heading = meta.title.split(/[:|]/)[0].trim();
  let body = `<p>${esc(meta.description)}</p>${list([link("/", "Live scores"), link("/leagues", "Leagues"), link("/news", "News")])}`;
  let cache = 300, built = null;
  try {
    if (path === "/") built = await buildHome(origin);
    else if ((kind === "livescores" || kind === "predictions") && (!slug || isDaySlug(slug))) built = await buildDay(kind, slug || todayUtc(), path, origin, slug);
    else if (kind === "predictions" && /^\d+/.test(slug || "")) built = await buildLeaguePredictions(parseInt(slug, 10), path, origin, slug);
    else if (kind === "match" && /^\d+$/.test(slug || "")) built = await buildMatch(slug, path, origin);
    else if (kind === "league" && /^\d+/.test(slug || "")) built = await buildLeague(parseInt(slug, 10), path, origin, slug);
    else if (kind === "club" && /^\d+/.test(slug || "")) built = await buildClub(parseInt(slug, 10), path, origin, slug);
    else if (kind === "player" && /^\d+/.test(slug || "")) built = await buildPlayer(parseInt(slug, 10), path, origin, slug);
    else if (kind === "venue" && /^\d+/.test(slug || "")) built = await buildVenue(parseInt(slug, 10), path, origin, slug);
    else if (kind === "news" && slug) { const id = parseArticleId(slug); built = id ? await buildArticle(id, path, origin) : { notFound: true }; }
    else if (["match", "league", "club", "player", "venue"].includes(kind)) built = { notFound: true }; // no usable id in the address
  } catch (error) {
    console.error("SEO prerender error:", error?.message || error); // fall back to the generic page
  }

  if (built?.redirect) return { status: 301, headers: { Location: origin + built.redirect, "Cache-Control": "public, s-maxage=86400" }, html: "" };
  if (built?.notFound) {
    const nf = { title: `Not found | ${SITE_NAME}`, description: "We couldn't find that page.", noindex: true, path, kind: "page" };
    return { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" }, html: html({ meta: nf, heading: "Not found", body: `<p>We couldn't find that page.</p>${list([link("/", "Live scores"), link("/leagues", "Leagues"), link("/news", "News")])}`, status: 404 }) };
  }
  if (built) {
    meta = built.meta || meta; heading = built.heading || heading; body = built.body; cache = built.cache ?? cache;
    jsonLd = built.jsonLd || [];
    if (path === "/" ) jsonLd = [...jsonLd];
  } else if (["match", "league", "club", "player", "venue", "livescores", "predictions"].includes(kind) || kind === "news") {
    cache = 60; // no data this time (quota, cap or provider down): serve the plain page, and try again soon
  }
  return { status: 200, headers: { "Cache-Control": `public, s-maxage=${cache}, stale-while-revalidate=${Math.max(3600, cache * 4)}` }, html: html({ meta, heading, body, jsonLd }) };
}

export { siteOrigin };
