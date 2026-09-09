import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { Skeleton } from "./Skeleton.js";
import { searchLeagues, searchTeams, searchVenues, searchPlayers } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

function skeletonRow() {
  return h("div", { style: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 18px" } }, [
    Skeleton({ style: { width: "32px", height: "32px", borderRadius: "6px" } }),
    Skeleton({ style: { flex: "1", height: "12px", borderRadius: "4px" } }),
  ]);
}

function resultRow({ image, title, subtitle, route }) {
  return h(
    "div",
    {
      role: "button",
      tabindex: "0",
      onClick: () => navigate(route),
      style: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 18px", borderBottom: "0.5px solid var(--border-soft)" },
    },
    [
      image
        ? h("img", { src: image, alt: "", style: { width: "32px", height: "32px", objectFit: "contain", borderRadius: "6px", flexShrink: "0" } })
        : h("div", { className: "skeleton", style: { width: "32px", height: "32px", borderRadius: "6px", flexShrink: "0" } }),
      h("div", { style: { flex: "1", minWidth: "0" } }, [
        text("div", { style: { fontSize: "14px", fontWeight: "500" } }, title),
        subtitle ? text("div", { className: "mono eyebrow", style: { marginTop: "2px" } }, subtitle.toUpperCase()) : null,
      ]),
    ]
  );
}

// Each section fetches and paints itself independently, so results appear
// as soon as their own request resolves rather than waiting on the slowest
// of four parallel calls.
function section(container, { label, run, mapResult }) {
  const wrap = h("div", { style: { display: "none" } });
  const heading = text("div", { style: { padding: "14px 18px 4px", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" } }, label);
  const list = h("div", {});
  wrap.appendChild(heading);
  wrap.appendChild(list);
  container.appendChild(wrap);

  return {
    reset() {
      wrap.style.display = "none";
      list.innerHTML = "";
    },
    load(query) {
      wrap.style.display = "block";
      list.innerHTML = "";
      list.appendChild(skeletonRow());
      list.appendChild(skeletonRow());
      run(query)
        .then((results) => {
          list.innerHTML = "";
          if (results.length === 0) {
            wrap.style.display = "none";
            return;
          }
          results.slice(0, 5).forEach((r) => list.appendChild(resultRow(mapResult(r))));
        })
        .catch(() => {
          wrap.style.display = "none";
        });
    },
  };
}

export function SearchScreen({ onBack }) {
  const container = h("div", { className: "screen" });
  container.appendChild(PageHeader({ title: "Search", onBack }));

  const searchInput = h("input", { type: "text", placeholder: "Search clubs, players, venues, leagues\u2026" });
  container.appendChild(h("div", { style: { padding: "14px 18px" } }, [searchInput]));

  const emptyState = text("div", { style: { padding: "40px 18px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" } }, "Search across clubs, players, venues, and leagues.");
  container.appendChild(emptyState);

  const sectionsWrap = h("div", {});
  container.appendChild(sectionsWrap);

  const leagueSection = section(sectionsWrap, {
    label: "Leagues",
    run: searchLeagues,
    mapResult: (r) => ({ image: r.league.logo, title: r.league.name, subtitle: r.country?.name, route: `/league/${buildSlug(r.league.id, r.league.name)}` }),
  });
  const teamSection = section(sectionsWrap, {
    label: "Clubs",
    run: searchTeams,
    mapResult: (r) => ({ image: r.team.logo, title: r.team.name, subtitle: r.team.country, route: `/club/${buildSlug(r.team.id, r.team.name)}` }),
  });
  const venueSection = section(sectionsWrap, {
    label: "Venues",
    run: searchVenues,
    mapResult: (r) => ({ image: r.image, title: r.name, subtitle: r.city, route: `/venue/${buildSlug(r.id, r.name)}` }),
  });
  // API-Football's /players endpoint typically needs league+season alongside
  // search for reliable results — free-text search alone may return little.
  // Wired up so it's ready once that's tuned; flagged here rather than hidden.
  const playerSection = section(sectionsWrap, {
    label: "Players",
    run: searchPlayers,
    mapResult: (r) => ({ image: r.player.photo, title: r.player.name, subtitle: r.player.nationality, route: `/player/${buildSlug(r.player.id, r.player.name)}` }),
  });

  let debounceTimer = null;
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    clearTimeout(debounceTimer);

    if (!query || query.length < 2) {
      emptyState.style.display = "block";
      [leagueSection, teamSection, venueSection, playerSection].forEach((s) => s.reset());
      return;
    }

    emptyState.style.display = "none";
    debounceTimer = setTimeout(() => {
      leagueSection.load(query);
      teamSection.load(query);
      venueSection.load(query);
      playerSection.load(query);
    }, 350);
  });

  return container;
}
