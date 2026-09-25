import { h, text } from "../utils/h.js";
import { SkeletonList } from "./Skeleton.js";
import { searchLeagues, getLeagueById } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

const POPULAR_LEAGUE_IDS = [39, 140, 135, 78, 61, 2];
const MIN_QUERY = 3; // API-Football requires at least 3 characters for league search

// Navigate by id (not name): names collide across countries ("Premier League",
// "Serie A", "Bundesliga"), so a name slug can open the wrong competition.
function leagueRow(entry) {
  const { league, country } = entry;
  return h("button", { className: "league-row", onClick: () => navigate("/league/" + buildSlug(league.id, league.name)), "aria-label": "Open " + league.name }, [
    h("img", { src: league.logo, alt: league.name, className: "league-logo" }),
    h("span", { className: "league-row-copy" }, [text("strong", {}, league.name), text("small", {}, country?.name || "")]),
    h("i", { "data-lucide": "chevron-right", "aria-hidden": "true" }),
  ]);
}

function fillSkeletons(target, count) {
  target.replaceChildren(SkeletonList({ rows: count }));
}

export function LeaguesScreen() {
  const container = h("main", { className: "screen leagues-screen" });
  const input = h("input", { className: "league-search-input", type: "search", placeholder: "Search any league", "aria-label": "Search leagues" });
  const popular = h("section", { className: "league-popular" });
  const results = h("section", { className: "league-results" });
  container.append(
    h("header", { className: "page-intro" }, [
      text("span", { className: "section-kicker" }, "Competitions"),
      h("div", { className: "page-intro-row" }, [text("h1", {}, "Leagues"), h("span", { className: "count-pill" }, "Global")]),
      text("p", {}, "Follow standings, fixtures and scoring leaders."),
    ]),
    h("div", { className: "search-shell" }, [h("i", { "data-lucide": "search", className: "search-icon" }), input]),
    popular,
    results
  );

  function renderPopular(list) {
    popular.innerHTML = "";
    popular.appendChild(text("div", { className: "section-kicker league-section-kicker" }, "Popular"));
    if (!list.length) popular.appendChild(text("div", { className: "empty-state" }, "Popular leagues are unavailable right now."));
    else list.forEach((entry) => popular.appendChild(leagueRow(entry)));
  }

  fillSkeletons(popular, 6);
  Promise.allSettled(POPULAR_LEAGUE_IDS.map((id) => getLeagueById(id))).then((settled) => {
    const found = settled
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => (Array.isArray(r.value) ? r.value : []));
    if (!found.length) {
      const firstError = settled.find((r) => r.status === "rejected")?.reason;
      popular.innerHTML = "";
      popular.appendChild(text("div", { className: "error-state" }, firstError?.message || "Unable to load football data."));
      return;
    }
    renderPopular(found);
  });

  let timer = 0;
  let searchSeq = 0; // ignore responses that arrive after a newer query
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const query = input.value.trim();
    searchSeq++;
    if (!query) { results.innerHTML = ""; popular.style.display = ""; return; }
    popular.style.display = "none";
    if (query.length < MIN_QUERY) {
      results.innerHTML = "";
      results.appendChild(text("div", { className: "empty-state" }, "Type at least " + MIN_QUERY + " characters."));
      return;
    }
    const seq = searchSeq;
    timer = setTimeout(() => {
      fillSkeletons(results, 4);
      searchLeagues(query).then((found) => {
        if (seq !== searchSeq) return;
        results.innerHTML = "";
        if (!found.length) { results.appendChild(text("div", { className: "empty-state" }, "No leagues found.")); return; }
        found.slice(0, 20).forEach((entry) => results.appendChild(leagueRow(entry)));
      }).catch((err) => {
        if (seq !== searchSeq) return;
        results.innerHTML = "";
        results.appendChild(text("div", { className: "error-state" }, err.message || "Unable to load leagues."));
      });
    }, 300);
  });
  return container;
}
