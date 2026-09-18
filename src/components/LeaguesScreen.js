import { h, text } from "../utils/h.js";
import { Skeleton } from "./Skeleton.js";
import { searchLeagues, getLeagueById } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

const POPULAR_LEAGUE_IDS = [39, 140, 135, 78, 61, 2]; // EPL, La Liga, Serie A, Bundesliga, Ligue 1, UCL

// Module-level memo (not store state) — avoids refetching every time the
// user taps back to this tab, without needing this to be globally reactive.
let popularCache = null;

function leagueRow(entry) {
  const { league, country } = entry;
  return h(
    "div",
    {
      role: "button",
      tabindex: "0",
      onClick: () => navigate(`/league/${buildSlug(league.id, league.name)}`),
      style: { display: "flex", alignItems: "center", gap: "12px", padding: "13px 18px", borderBottom: "0.5px solid var(--border-soft)" },
    },
    [
      h("img", { src: league.logo, alt: "", style: { width: "32px", height: "32px", objectFit: "contain", flexShrink: "0" } }),
      h("div", { style: { flex: "1", minWidth: "0" } }, [
        text("div", { style: { fontSize: "14px", fontWeight: "500" } }, league.name),
        text("div", { className: "mono eyebrow", style: { marginTop: "2px" } }, (country?.name || "").toUpperCase()),
      ]),
      h("i", { "data-lucide": "chevron-right", "aria-hidden": "true", style: { width: "16px", height: "16px", color: "var(--text-muted)", flexShrink: "0" } }),
    ]
  );
}

function skeletonRow() {
  return h("div", { style: { display: "flex", alignItems: "center", gap: "12px", padding: "13px 18px", borderBottom: "0.5px solid var(--border-soft)" } }, [
    Skeleton({ style: { width: "32px", height: "32px", borderRadius: "6px" } }),
    h("div", { style: { flex: "1", display: "flex", flexDirection: "column", gap: "6px" } }, [
      Skeleton({ style: { width: "60%", height: "12px", borderRadius: "4px" } }),
      Skeleton({ style: { width: "35%", height: "9px", borderRadius: "4px" } }),
    ]),
  ]);
}

function fillSkeletons(target, count) {
  target.innerHTML = "";
  for (let i = 0; i < count; i++) target.appendChild(skeletonRow());
}

export function LeaguesScreen() {
  const container = h("main", { className: "screen leagues-screen" });
  const searchInput = h("input", { type: "search", placeholder: "Search any league", "aria-label": "Search leagues" });
  const popularSection = h("section", { className: "league-popular" });
  const resultsSection = h("section", { className: "league-results" });

  container.append(
    h("header", { className: "page-intro" }, [
      text("span", { className: "section-kicker" }, "COMPETITIONS"),
      h("div", { className: "page-intro-row" }, [
        text("h1", {}, "Leagues"),
        h("span", { className: "count-pill" }, "Global")
      ]),
      text("p", {}, "Follow standings, fixtures and scoring leaders.")
    ]),
    h("div", { className: "search-shell" }, [
      h("i", { "data-lucide": "search", className: "search-icon" }),
      searchInput
    ]),
    popularSection,
    resultsSection
  );

  function renderPopular(list) {
    popularSection.innerHTML = "";
    if (!list.length) return;
    popularSection.appendChild(text("div", { className: "section-kicker league-section-kicker" }, "Popular"));
    list.forEach((entry) => popularSection.appendChild(leagueRow(entry)));
  }

  if (popularCache) renderPopular(popularCache);
  else {
    fillSkeletons(popularSection, 5);
    Promise.all(POPULAR_LEAGUE_IDS.map((id) => getLeagueById(id).catch(() => []))).then((results) => {
      popularCache = results.flat();
      renderPopular(popularCache);
    });
  }

  let timer;
  searchInput.addEventListener("input", () => {
    clearTimeout(timer);
    const q = searchInput.value.trim();
    if (!q) { resultsSection.innerHTML = ""; popularSection.style.display = ""; return; }
    popularSection.style.display = "none";
    if (q.length < 2) return;
    timer = setTimeout(() => {
      fillSkeletons(resultsSection, 4);
      searchLeagues(q).then((results) => {
        resultsSection.innerHTML = "";
        if (!results.length) { resultsSection.appendChild(text("div", { className: "empty-state" }, "No leagues found.")); return; }
        results.forEach((entry) => resultsSection.appendChild(leagueRow(entry)));
      }).catch((err) => {
        resultsSection.innerHTML = "";
        resultsSection.appendChild(text("div", { className: "error-state" }, err.message || "Unable to load leagues."));
      });
    }, 300);
  });
  return container;
}
