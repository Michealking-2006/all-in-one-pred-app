import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { Skeleton } from "./Skeleton.js";
import { searchLeagues, searchTeams, searchVenues, searchPlayers } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { getBestSeason } from "../utils/fixtures.js";
import { navigate } from "../router.js";

function skeletonRow() {
  return h("div", { className: "search-skeleton-row" }, [
    Skeleton({ style: { width: "36px", height: "36px", borderRadius: "8px" } }),
    Skeleton({ style: { flex: "1", height: "14px", borderRadius: "5px" } }),
  ]);
}

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

const emptyText = (message) => text("div", { className: "search-empty" }, message);

function searchField(placeholder) {
  const input = h("input", {
    type: "search", placeholder, enterkeyhint: "search", autocomplete: "off", autocapitalize: "none", autocorrect: "off", spellcheck: "false", "aria-label": placeholder,
  });
  return { input, node: h("div", { className: "search-field" }, [h("i", { "data-lucide": "search", "aria-hidden": "true" }), input]) };
}

// Each section fetches and paints itself independently, so results appear as
// soon as their own request resolves instead of waiting for the slowest call.
function section(container, { label, run, mapResult }) {
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
      run(query)
        .then((results) => {
          if (mine !== seq) return;
          list.replaceChildren();
          if (!results.length) { wrap.hidden = true; return; }
          results.slice(0, 5).forEach((r) => list.appendChild(resultRow(mapResult(r))));
        })
        .catch(() => { if (mine === seq) wrap.hidden = true; });
    },
  };
}

function buildAllMode() {
  const wrap = h("div", {});
  const field = searchField("Search clubs, venues, leagues\u2026");
  const emptyState = emptyText("Search across clubs, venues and leagues. Type at least 3 characters.");
  const sectionsWrap = h("div", {});
  wrap.append(field.node, emptyState, sectionsWrap);

  const go = (route) => () => navigate(route);
  const sections = [
    section(sectionsWrap, {
      label: "Leagues", run: searchLeagues,
      mapResult: (r) => ({ image: r.league.logo, title: r.league.name, subtitle: r.country?.name, onClick: go(`/league/${buildSlug(r.league.id, r.league.name)}`) }),
    }),
    section(sectionsWrap, {
      label: "Clubs", run: searchTeams,
      mapResult: (r) => ({ image: r.team.logo, title: r.team.name, subtitle: r.team.country, onClick: go(`/club/${buildSlug(r.team.id, r.team.name)}`) }),
    }),
    section(sectionsWrap, {
      label: "Venues", run: searchVenues,
      mapResult: (r) => ({ image: r.image, title: r.name, subtitle: r.city, onClick: go(`/venue/${buildSlug(r.id, r.name)}`) }),
    }),
  ];

  let debounce = null;
  field.input.addEventListener("input", () => {
    const query = field.input.value.trim();
    clearTimeout(debounce);
    if (query.length < 3) {
      emptyState.hidden = false;
      sections.forEach((s) => s.reset());
      return;
    }
    emptyState.hidden = true;
    debounce = setTimeout(() => sections.forEach((s) => s.load(query)), 350);
  });
  return wrap;
}

// Player search needs a league (API-Football requires `league` or `team`
// alongside `search`), so it is a two-step flow: pick a league, then search its players.
function buildPlayerSearchMode() {
  const wrap = h("div", { className: "player-search-wrap" });

  const leagueStep = h("div", {});
  const playerStep = h("div", { hidden: true });
  wrap.append(leagueStep, playerStep);

  const leagueField = searchField("Search for a league\u2026");
  const leagueResults = h("div", { className: "search-results-group", hidden: true });
  leagueStep.append(
    text("p", { className: "search-hint" }, "Player search needs a league first. Pick one to search its players."),
    leagueField.node,
    leagueResults
  );

  const selectedBar = h("div", { className: "search-selected" });
  const playerField = searchField("Search players in this league\u2026");
  const playerHint = text("p", { className: "search-hint" }, "Type at least 4 characters.");
  const playerResults = h("div", { className: "search-results-group", hidden: true });
  playerStep.append(selectedBar, playerField.node, playerHint, playerResults);

  const setResults = (box, ...nodes) => { box.hidden = nodes.length === 0; box.replaceChildren(...nodes); };

  function selectLeague(entry) {
    const league = entry.league;
    const season = getBestSeason(entry);
    let playerSeq = 0;
    leagueStep.hidden = true;
    playerStep.hidden = false;
    playerField.input.value = "";
    setResults(playerResults);

    selectedBar.replaceChildren(
      h("div", {}, [h("img", { src: league.logo, alt: "" }), text("span", {}, league.name)]),
      text("button", { type: "button", className: "text-action", onClick: () => { playerStep.hidden = true; leagueStep.hidden = false; } }, "Change")
    );

    let debounce = null;
    playerField.input.oninput = () => {
      const q = playerField.input.value.trim();
      clearTimeout(debounce);
      const mine = ++playerSeq;
      if (q.length < 4) { setResults(playerResults); return; }
      debounce = setTimeout(() => {
        setResults(playerResults, skeletonRow(), skeletonRow());
        searchPlayers(q, { league: league.id, season })
          .then((results) => {
            if (mine !== playerSeq) return;
            if (!results.length) { setResults(playerResults); playerResults.hidden = true; playerHint.textContent = `No players found for "${q}" in ${league.name}.`; return; }
            playerHint.textContent = "Type at least 4 characters.";
            setResults(playerResults, ...results.slice(0, 8).map((entry) => {
              const p = entry.player;
              return resultRow({ image: p.photo, title: p.name, subtitle: p.nationality, onClick: () => navigate(`/player/${buildSlug(p.id, p.name)}`) });
            }));
          })
          .catch((error) => {
            if (mine !== playerSeq) return;
            setResults(playerResults);
            playerHint.textContent = error?.message || "Couldn't load results. Check your connection.";
          });
      }, 350);
    };
  }

  let debounce = null;
  let leagueSeq = 0;
  leagueField.input.addEventListener("input", () => {
    const q = leagueField.input.value.trim();
    clearTimeout(debounce);
    const mine = ++leagueSeq;
    if (q.length < 3) { setResults(leagueResults); return; }
    debounce = setTimeout(() => {
      setResults(leagueResults, skeletonRow(), skeletonRow());
      searchLeagues(q)
        .then((results) => {
          if (mine !== leagueSeq) return;
          if (!results.length) { setResults(leagueResults, emptyText(`No leagues found for "${q}"`)); leagueResults.hidden = false; return; }
          setResults(leagueResults, ...results.slice(0, 6).map((entry) =>
            resultRow({ image: entry.league.logo, title: entry.league.name, subtitle: entry.country?.name, onClick: () => selectLeague(entry) })
          ));
        })
        .catch((error) => {
          if (mine !== leagueSeq) return;
          setResults(leagueResults, emptyText(error?.message || "Couldn't load results. Check your connection."));
          leagueResults.hidden = false;
        });
    }, 350);
  });

  return wrap;
}

export function SearchScreen({ onBack }) {
  const container = h("main", { className: "screen search-screen" });
  const allMode = buildAllMode();
  const playerMode = buildPlayerSearchMode();
  const allTab = h("button", { type: "button", className: "search-tab active", onClick: () => setMode("all") }, "All");
  const playersTab = h("button", { type: "button", className: "search-tab", onClick: () => setMode("players") }, "Players");

  container.append(
    PageHeader({ title: "Search", onBack }),
    h("div", { className: "search-tabs", role: "tablist" }, [allTab, playersTab]),
    allMode,
    playerMode
  );
  playerMode.hidden = true;

  function setMode(mode) {
    allTab.classList.toggle("active", mode === "all");
    playersTab.classList.toggle("active", mode === "players");
    allMode.hidden = mode !== "all";
    playerMode.hidden = mode !== "players";
  }
  return container;
}
