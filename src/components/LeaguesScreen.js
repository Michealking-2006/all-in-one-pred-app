import { h, text } from "../utils/h.js";
import { Skeleton } from "./Skeleton.js";
import { searchLeagues, getLeagueById } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

const POPULAR_LEAGUE_IDS = [39, 140, 135, 78, 61, 2];
let popularCache = null;

function leagueRow(entry) {
  const { league, country } = entry;
  return h("button", { className: "league-row", onClick: () => navigate("/league/" + buildSlug(league.id, league.name)), "aria-label": "Open " + league.name }, [
    h("img", { src: league.logo, alt: league.name, className: "league-logo" }),
    h("span", { className: "league-row-copy" }, [text("strong", {}, league.name), text("small", {}, (country?.name || "").toUpperCase())]),
    h("i", { "data-lucide": "chevron-right", "aria-hidden": "true" }),
  ]);
}
function skeletonRow() {
  return h("div", { className: "league-row skeleton-league-row" }, [Skeleton({ style: { width: "36px", height: "36px", borderRadius: "10px" } }), h("div", { className: "league-row-copy" }, [Skeleton({ style: { width: "60%", height: "12px", borderRadius: "4px" } }), Skeleton({ style: { width: "35%", height: "9px", borderRadius: "4px" } })])]);
}
function fillSkeletons(target, count) { target.innerHTML = ""; for (let i = 0; i < count; i++) target.appendChild(skeletonRow()); }

export function LeaguesScreen() {
  const container = h("main", { className: "screen leagues-screen" });
  const input = h("input", { className: "league-search-input", type: "search", placeholder: "Search any league", "aria-label": "Search leagues" });
  const popular = h("section", { className: "league-popular" });
  const results = h("section", { className: "league-results" });
  container.append(
    h("header", { className: "page-intro" }, [text("span", { className: "section-kicker" }, "COMPETITIONS"), h("div", { className: "page-intro-row" }, [text("h1", {}, "Leagues"), h("span", { className: "count-pill" }, "Global")]), text("p", {}, "Follow standings, fixtures and scoring leaders.")]),
    h("div", { className: "search-shell" }, [h("i", { "data-lucide": "search", className: "search-icon" }), input]),
    popular, results
  );
  function renderPopular(list) {
    popular.innerHTML = "";
    popular.appendChild(text("div", { className: "section-kicker league-section-kicker" }, list.length ? "Popular" : "Popular leagues"));
    if (!list.length) popular.appendChild(text("div", { className: "empty-state" }, "Popular leagues are unavailable right now."));
    else list.forEach((entry) => popular.appendChild(leagueRow(entry)));
  }
  if (popularCache) renderPopular(popularCache);
  else {
    fillSkeletons(popular, 6);
    Promise.all(POPULAR_LEAGUE_IDS.map((id) => getLeagueById(id).catch(() => null))).then((rows) => {
      popularCache = rows.flatMap((row) => Array.isArray(row) ? row : []);
      renderPopular(popularCache);
    });
  }
  let timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const query = input.value.trim();
    if (!query) { results.innerHTML = ""; popular.style.display = ""; return; }
    popular.style.display = "none";
    if (query.length < 2) { results.innerHTML = ""; return; }
    timer = setTimeout(() => {
      fillSkeletons(results, 4);
      searchLeagues(query).then((found) => {
        results.innerHTML = "";
        if (!found.length) { results.appendChild(text("div", { className: "empty-state" }, "No leagues found.")); return; }
        found.slice(0, 20).forEach((entry) => results.appendChild(leagueRow(entry)));
      }).catch((err) => {
        results.innerHTML = "";
        results.appendChild(text("div", { className: "error-state" }, err.message || "Unable to load leagues."));
      });
    }, 300);
  });
  return container;
}