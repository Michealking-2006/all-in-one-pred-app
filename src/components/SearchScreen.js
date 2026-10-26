import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { SkeletonRow } from "./Skeleton.js";
import { searchLeagues, searchTeams, searchVenues, searchPlayers, getFixturesByDate, getTeamFixtures } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { localDateISO, isLive, isFinished, statusLabel } from "../utils/fixtures.js";
import { navigate } from "../router.js";

const skeletonRow = () => SkeletonRow({ lines: 1 });

function resultRow({ image, title, subtitle, onClick }) {
  return h("button", { type: "button", className: "search-result-row", onClick }, [
    image ? h("img", { src: image, alt: "", className: "search-result-image", loading: "lazy" }) : h("div", { className: "search-result-image" }),
    h("div", { className: "search-result-copy" }, [
      text("div", { className: "search-result-title" }, title),
      subtitle ? text("div", { className: "search-result-subtitle" }, subtitle) : null,
    ]),
    h("i", { "data-lucide": "chevron-right", className: "profile-chevron" }),
  ]);
}

// A match needs two crests and a score/time, so it gets its own row shape
// rather than the single-image resultRow used for leagues/clubs/venues/players.
function matchResultRow(fx) {
  const home = fx.teams?.home, away = fx.teams?.away;
  const live = isLive(fx.fixture?.status?.short);
  const finished = isFinished(fx.fixture?.status?.short);
  const score = finished || live ? `${fx.goals?.home ?? 0}\u2013${fx.goals?.away ?? 0}` : statusLabel(fx);
  return h("button", { type: "button", className: "search-result-row search-match-row", onClick: () => navigate("/match/" + fx.fixture.id) }, [
    h("div", { className: "search-match-crests" }, [
      home?.logo ? h("img", { src: home.logo, alt: "", className: "search-match-crest" }) : h("span", { className: "search-match-crest" }),
      away?.logo ? h("img", { src: away.logo, alt: "", className: "search-match-crest" }) : h("span", { className: "search-match-crest" }),
    ]),
    h("div", { className: "search-result-copy" }, [
      text("div", { className: "search-result-title" }, `${home?.name || "TBD"} vs ${away?.name || "TBD"}`),
      text("div", { className: "search-result-subtitle" }, fx.league?.name || ""),
    ]),
    text("div", { className: "search-match-score" + (live ? " is-live" : "") }, score),
  ]);
}

const emptyText = (message) => text("div", { className: "search-empty" }, message);

function searchField(placeholder) {
  const input = h("input", {
    type: "search", placeholder, enterkeyhint: "search", autocomplete: "off", autocapitalize: "none", autocorrect: "off", spellcheck: "false", "aria-label": placeholder,
  });
  return { input, node: h("div", { className: "search-field" }, [h("i", { "data-lucide": "search", "aria-hidden": "true" }), input]) };
}

// Today's fixtures, filtered client-side by team name. Reuses whatever the
// Home screen already cached this session rather than a dedicated endpoint
// (API-Football has no free-text match search), so this covers today only —
// labelled "Today's matches" rather than implying full match search.
function searchTodaysMatches(query) {
  const q = query.trim().toLowerCase();
  return getFixturesByDate(localDateISO()).then((rows) =>
    rows.filter((fx) => fx.teams?.home?.name?.toLowerCase().includes(q) || fx.teams?.away?.name?.toLowerCase().includes(q))
  );
}

// Each section fetches and paints itself independently, so results appear as
// soon as their own request resolves instead of waiting for the slowest call.
// load(query) resolves to true/false: whether it ended up showing anything,
// so the caller can tell when every section came back empty.
function section(container, { label, run, mapResult, renderRow, limit = 5 }) {
  const wrap = h("div", { hidden: true });
  const list = h("div", { className: "search-results-group" });
  wrap.append(text("div", { className: "search-group-label" }, label), list);
  container.appendChild(wrap);

  let seq = 0; // ignore responses that arrive after a newer query
  return {
    reset() {
      seq++;
      wrap.hidden = true;
      list.replaceChildren();
    },
    load(query) {
      const mine = ++seq;
      wrap.hidden = false;
      list.replaceChildren(skeletonRow(), skeletonRow());
      // Promise.resolve().then(...) so a synchronous throw is also reported
      // as a failure instead of leaving the section blank.
      return Promise.resolve().then(() => run(query))
        .then((results) => {
          if (mine !== seq) return false;
          list.replaceChildren();
          if (!results.length) { wrap.hidden = true; return false; }
          results.slice(0, limit).forEach((r) => list.appendChild(renderRow ? renderRow(r) : resultRow(mapResult(r))));
          return true;
        })
        .catch((error) => {
          if (mine !== seq) return false;
          list.replaceChildren(h("div", { className: "search-error", role: "alert" }, [
            text("p", {}, error?.message || `Couldn't load ${label.toLowerCase()}. Check your connection and try again.`),
            h("button", { type: "button", className: "secondary-button", onClick: () => this.load(query) }, "Try again"),
          ]));
          wrap.hidden = false;
          return true; // an error is shown, not silently swallowed as "no results"
        });
    },
  };
}

// Team-based match search. API-Football has no free-text match search, so the
// best honest version is: find the best-matching teams, then pull each one's
// last and next few fixtures. Both "Upcoming" and "Recent results" share one
// fetch per query. Today's games are left to the "Today's matches" section.
const fixtureLocalDate = (fx) => {
  const d = new Date(fx.fixture.date);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
let teamMatchesMemo = { query: null, promise: null };
function searchTeamMatches(query) {
  if (teamMatchesMemo.query === query) return teamMatchesMemo.promise;
  const promise = searchTeams(query).then((teams) => {
    const picks = teams.slice(0, 2).map((r) => r.team?.id).filter(Boolean);
    return Promise.all(picks.map((id) =>
      Promise.all([getTeamFixtures(id, { last: 5 }), getTeamFixtures(id, { next: 5 })]).then(([past, next]) => [...past, ...next])
    ));
  }).then((groups) => {
    const seen = new Set();
    const today = localDateISO();
    return groups.flat().filter((fx) => {
      const id = fx?.fixture?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return fixtureLocalDate(fx) !== today;
    });
  });
  promise.catch(() => { if (teamMatchesMemo.promise === promise) teamMatchesMemo = { query: null, promise: null }; });
  teamMatchesMemo = { query, promise };
  return promise;
}
const isUpcoming = (fx) => new Date(fx.fixture.date).getTime() > Date.now() && !isFinished(fx.fixture?.status?.short) && !isLive(fx.fixture?.status?.short);
const searchUpcoming = (q) => searchTeamMatches(q).then((rows) => rows.filter(isUpcoming).sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date)));
const searchRecent = (q) => searchTeamMatches(q).then((rows) => rows.filter((fx) => !isUpcoming(fx)).sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date)));

// Section factories, keyed by what they search. `big` = the dedicated tab, which
// shows more rows than the combined "All" tab.
const go = (route) => () => navigate(route);
const SECTION_DEFS = {
  today: (big) => ({ label: "Today's matches", run: searchTodaysMatches, renderRow: matchResultRow, limit: big ? 15 : 5 }),
  upcoming: () => ({ label: "Upcoming", run: searchUpcoming, renderRow: matchResultRow, limit: 10 }),
  recent: () => ({ label: "Recent results", run: searchRecent, renderRow: matchResultRow, limit: 10 }),
  leagues: (big) => ({
    label: "Leagues", run: searchLeagues, limit: big ? 15 : 5,
    mapResult: (r) => ({ image: r.league.logo, title: r.league.name, subtitle: r.country?.name, onClick: go(`/league/${buildSlug(r.league.id, r.league.name)}`) }),
  }),
  teams: (big) => ({
    label: "Clubs", run: searchTeams, limit: big ? 15 : 5,
    mapResult: (r) => ({ image: r.team.logo, title: r.team.name, subtitle: r.team.country, onClick: go(`/club/${buildSlug(r.team.id, r.team.name)}`) }),
  }),
  players: (big) => ({
    label: "Players", run: searchPlayers, limit: big ? 20 : 5,
    mapResult: (r) => ({
      image: r.player.photo, title: r.player.name,
      subtitle: [r.player.position, r.player.nationality, r.player.age ? r.player.age + " yrs" : null].filter(Boolean).join(" \u00b7 "),
      onClick: go(`/player/${buildSlug(r.player.id, r.player.name)}`),
    }),
  }),
  venues: (big) => ({
    label: "Venues", run: searchVenues, limit: big ? 15 : 5,
    mapResult: (r) => ({ image: r.image, title: r.name, subtitle: r.city, onClick: go(`/venue/${buildSlug(r.id, r.name)}`) }),
  }),
};

const MIN_QUERY = 3;

// One tab's results area. All query tabs share the single search field above
// them; a tab only fetches when it is the visible one, and only when its last
// loaded query differs from the current one.
function buildQueryMode({ keys, big, emptyMessage }) {
  const node = h("div", {});
  const emptyState = emptyText(emptyMessage);
  const noResults = h("div", { hidden: true });
  const sectionsWrap = h("div", {});
  node.append(emptyState, noResults, sectionsWrap);
  const sections = keys.map((key) => section(sectionsWrap, SECTION_DEFS[key](big)));

  let lastQuery = "";
  let runSeq = 0; // one per query "run" across this tab's sections together

  function update(query) {
    if (query === lastQuery) return;
    lastQuery = query;
    const mine = ++runSeq;
    noResults.hidden = true;
    if (!query) {
      emptyState.hidden = false;
      sections.forEach((sec) => sec.reset());
      return;
    }
    emptyState.hidden = true;
    Promise.all(sections.map((sec) => sec.load(query))).then((outcomes) => {
      if (mine !== runSeq) return; // a newer query has since started
      noResults.hidden = outcomes.some(Boolean);
      if (!noResults.hidden) noResults.replaceChildren(text("div", { className: "search-no-results" }, `No results for "${query}".`));
    });
  }
  return { node, update };
}

const QUERY_TABS = [
  { id: "all", label: "All", placeholder: "Search football\u2026", keys: ["today", "teams", "leagues", "venues", "players"], big: false,
    emptyMessage: "Search across clubs, leagues, venues, players and today's matches. Type at least 3 characters." },
  { id: "matches", label: "Matches", placeholder: "Search matches by team\u2026", keys: ["today", "upcoming", "recent"], big: true,
    emptyMessage: "Type a team name to find its matches today, upcoming and recent. At least 3 characters." },
  { id: "teams", label: "Clubs", placeholder: "Search clubs\u2026", keys: ["teams"], big: true, emptyMessage: "Search for a club. Type at least 3 characters." },
  { id: "leagues", label: "Leagues", placeholder: "Search leagues\u2026", keys: ["leagues"], big: true, emptyMessage: "Search for a league or cup. Type at least 3 characters." },
  { id: "venues", label: "Venues", placeholder: "Search venues\u2026", keys: ["venues"], big: true, emptyMessage: "Search for a stadium. Type at least 3 characters." },
  { id: "players", label: "Players", placeholder: "Search players by name\u2026", keys: ["players"], big: true, emptyMessage: "Search for a player by name. Type at least 3 characters." },
];

export function SearchScreen({ onBack }) {
  const container = h("main", { className: "screen search-screen" });
  const field = searchField(QUERY_TABS[0].placeholder);
  const modes = new Map(QUERY_TABS.map((tab) => [tab.id, buildQueryMode(tab)]));

  let active = "all";
  const tabButtons = new Map();
  const tabs = QUERY_TABS.map((tab) => {
    const btn = h("button", {
      type: "button", role: "tab", className: "search-tab" + (tab.id === active ? " active" : ""),
      "aria-selected": String(tab.id === active), onClick: () => setMode(tab.id),
    }, tab.label);
    tabButtons.set(tab.id, btn);
    return btn;
  });

  const currentQuery = () => {
    const q = field.input.value.trim();
    return q.length >= MIN_QUERY ? q : "";
  };

  container.append(
    PageHeader({ title: "Search", onBack }),
    h("div", { className: "search-tabs", role: "tablist", "aria-label": "Search categories" }, tabs),
    field.node,
    ...QUERY_TABS.map((tab) => modes.get(tab.id).node)
  );
  modes.forEach((mode, id) => { mode.node.hidden = id !== active; });

  // /search?q=arsenal (the site's search action) opens with the query filled in.
  const initialQuery = (new URLSearchParams(window.location.search).get("q") || "").trim().slice(0, 60);
  if (initialQuery) window.setTimeout(() => { field.input.value = initialQuery; field.input.dispatchEvent(new Event("input")); }, 0);

  function setMode(mode) {
    active = mode;
    tabButtons.forEach((btn, id) => {
      btn.classList.toggle("active", id === mode);
      btn.setAttribute("aria-selected", String(id === mode));
    });
    modes.forEach((m, id) => { m.node.hidden = id !== mode; });
    tabButtons.get(mode)?.scrollIntoView?.({ inline: "center", block: "nearest" });
    const tab = QUERY_TABS.find((t) => t.id === mode);
    field.input.placeholder = tab.placeholder;
    field.input.setAttribute("aria-label", tab.placeholder);
    modes.get(mode).update(currentQuery());
  }

  // Short queries clear the visible tab right away; longer ones wait for a
  // pause in typing so a fast typist doesn't fire a request per letter.
  let debounce = null;
  field.input.addEventListener("input", () => {
    clearTimeout(debounce);
    const run = () => modes.get(active)?.update(currentQuery());
    if (!currentQuery()) run();
    else debounce = setTimeout(run, 350);
  });
  return container;
}
