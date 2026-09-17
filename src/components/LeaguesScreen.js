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
  const container = h("div", { className: "screen" });

  container.appendChild(text("div", { style: { padding: "16px 18px 12px", fontWeight: "700", fontSize: "18px" } }, "Leagues"));

  const searchInput = h("input", { type: "text", placeholder: "Search leagues\u2026" });
  container.appendChild(h("div", { style: { padding: "0 18px 14px" } }, [searchInput]));

  const popularSection = h("div", {});
  const resultsSection = h("div", {});
  container.appendChild(popularSection);
  container.appendChild(resultsSection);

  function renderPopular(list) {
    popularSection.innerHTML = "";
    if (list.length === 0) return;
    popularSection.appendChild(text("div", { style: { padding: "4px 18px 8px", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" } }, "Popular leagues"));
    list.forEach((entry) => popularSection.appendChild(leagueRow(entry)));
  }

  function loadPopular() {
    if (popularCache) {
      renderPopular(popularCache);
      return;
    }
    fillSkeletons(popularSection, 6);
    Promise.all(POPULAR_LEAGUE_IDS.map((id) => getLeagueById(id).catch(() => [])))
      .then((results) => {
        const flat = results.flat();
        popularCache = flat;
        renderPopular(flat);
      })
      .catch(() => {
        popularSection.innerHTML = "";
      });
  }

  let debounceTimer = null;
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    clearTimeout(debounceTimer);

    if (!query) {
      resultsSection.innerHTML = "";
      popularSection.style.display = "block";
      return;
    }

    popularSection.style.display = "none";
    debounceTimer = setTimeout(() => {
      fillSkeletons(resultsSection, 4);
      searchLeagues(query)
        .then((results) => {
          resultsSection.innerHTML = "";
          if (results.length === 0) {
            resultsSection.appendChild(text("div", { style: { padding: "30px 18px", fontSize: "13px", color: "var(--text-muted)", textAlign: "center" } }, `No leagues found for "${query}"`));
            return;
          }
          results.forEach((entry) => resultsSection.appendChild(leagueRow(entry)));
        })
        .catch((err) => {
          resultsSection.innerHTML = "";
          resultsSection.appendChild(text("div", { style: { padding: "30px 18px", fontSize: "13px", color: "var(--danger)", textAlign: "center" } }, err.message || "Couldn't load results \u2014 check your connection."));
        });
    }, 350);
  });

  loadPopular();

  return container;
}
