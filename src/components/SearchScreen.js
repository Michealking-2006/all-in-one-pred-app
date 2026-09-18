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

function emptyText(message) {
  return text("div", { style: { padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" } }, message);
}

function chip(label, onClick) {
  return h(
    "button",
    {
      onClick,
      style: {
        border: "0.5px solid var(--border)",
        background: "none",
        color: "var(--text-muted)",
        padding: "6px 14px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "600",
      },
    },
    label
  );
}

function setChipActive(btn, isActive) {
  btn.style.border = isActive ? "none" : "0.5px solid var(--border)";
  btn.style.background = isActive ? "var(--accent)" : "none";
  btn.style.color = isActive ? "var(--on-accent)" : "var(--text-muted)";
}

// Each section fetches and paints itself independently, so results appear
// as soon as their own request resolves rather than waiting on the slowest
// of the parallel calls.
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

// Player search needs a league (API-Football requires `league` or `team`
// alongside `search` — a bare free-text lookup isn't supported), so this is
// a two-step flow: pick a league, then search players within it.
function buildPlayerSearchMode() {
  const wrap = h("div", { style: { padding: "0 18px" } });

  const leagueStep = h("div", {});
  const playerStep = h("div", { style: { display: "none" } });
  wrap.appendChild(leagueStep);
  wrap.appendChild(playerStep);

  leagueStep.appendChild(
    text("div", { style: { fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" } }, "Player search needs a league first \u2014 pick one to search its players.")
  );
  const leagueInput = h("input", { type: "text", placeholder: "Search for a league\u2026" });
  leagueStep.appendChild(h("div", { style: { marginBottom: "12px" } }, [leagueInput]));
  const leagueResults = h("div", {});
  leagueStep.appendChild(leagueResults);

  const selectedLeagueBar = h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--surface)", borderRadius: "8px", marginBottom: "12px" } });
  const playerInput = h("input", { type: "text", placeholder: "Search players in this league\u2026" });
  const playerHint = text("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" } }, "Type at least 4 characters.");
  const playerResults = h("div", {});
  playerStep.appendChild(selectedLeagueBar);
  playerStep.appendChild(h("div", { style: { marginBottom: "6px" } }, [playerInput]));
  playerStep.appendChild(playerHint);
  playerStep.appendChild(playerResults);

  function selectLeague(league) {
    leagueStep.style.display = "none";
    playerStep.style.display = "block";
    playerInput.value = "";
    playerResults.innerHTML = "";

    selectedLeagueBar.innerHTML = "";
    selectedLeagueBar.appendChild(
      h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
        h("img", { src: league.logo, alt: "", style: { width: "20px", height: "20px", objectFit: "contain" } }),
        text("span", { style: { fontSize: "13px", fontWeight: "600" } }, league.name),
      ])
    );
    selectedLeagueBar.appendChild(
      text(
        "button",
        {
          onClick: () => {
            playerStep.style.display = "none";
            leagueStep.style.display = "block";
          },
          style: { border: "none", background: "none", color: "var(--accent)", fontSize: "12px", fontWeight: "600" },
        },
        "Change"
      )
    );

    let playerDebounce = null;
    playerInput.oninput = () => {
      const q = playerInput.value.trim();
      clearTimeout(playerDebounce);
      if (q.length < 4) {
        playerResults.innerHTML = "";
        return;
      }
      playerDebounce = setTimeout(() => {
        playerResults.innerHTML = "";
        playerResults.appendChild(skeletonRow());
        playerResults.appendChild(skeletonRow());
        searchPlayers(q, { league: league.id, season: new Date().getFullYear() })
          .then((results) => {
            playerResults.innerHTML = "";
            if (results.length === 0) {
              playerResults.appendChild(emptyText(`No players found for "${q}" in ${league.name}.`));
              return;
            }
            results.slice(0, 8).forEach((entry) => {
              const p = entry.player;
              playerResults.appendChild(resultRow({ image: p.photo, title: p.name, subtitle: p.nationality, route: `/player/${buildSlug(p.id, p.name)}` }));
            });
          })
          .catch(() => {
            playerResults.innerHTML = "";
            playerResults.appendChild(emptyText("Couldn't load results \u2014 check your connection."));
          });
      }, 350);
    };
  }

  let leagueDebounce = null;
  leagueInput.addEventListener("input", () => {
    const q = leagueInput.value.trim();
    clearTimeout(leagueDebounce);
    if (!q || q.length < 2) {
      leagueResults.innerHTML = "";
      return;
    }
    leagueDebounce = setTimeout(() => {
      leagueResults.innerHTML = "";
      leagueResults.appendChild(skeletonRow());
      leagueResults.appendChild(skeletonRow());
      searchLeagues(q)
        .then((results) => {
          leagueResults.innerHTML = "";
          if (results.length === 0) {
            leagueResults.appendChild(emptyText(`No leagues found for "${q}"`));
            return;
          }
          results.slice(0, 6).forEach((entry) =>
            leagueResults.appendChild(
              h(
                "div",
                {
                  role: "button",
                  tabindex: "0",
                  onClick: () => selectLeague(entry.league),
                  style: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "0.5px solid var(--border-soft)" },
                },
                [
                  h("img", { src: entry.league.logo, alt: "", style: { width: "28px", height: "28px", objectFit: "contain" } }),
                  text("div", { style: { flex: "1", fontSize: "13px", fontWeight: "500" } }, entry.league.name),
                ]
              )
            )
          );
        })
        .catch(() => {
          leagueResults.innerHTML = "";
          leagueResults.appendChild(emptyText("Couldn't load results \u2014 check your connection."));
        });
    }, 350);
  });

  return wrap;
}

function buildAllMode() {
  const wrap = h("div", {});

  const searchInput = h("input", { type: "text", placeholder: "Search clubs, venues, leagues\u2026" });
  wrap.appendChild(h("div", { style: { padding: "0 18px 14px" } }, [searchInput]));

  const emptyState = text("div", { style: { padding: "40px 18px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" } }, "Search across clubs, venues, and leagues.");
  wrap.appendChild(emptyState);

  const sectionsWrap = h("div", {});
  wrap.appendChild(sectionsWrap);

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

  let debounceTimer = null;
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    clearTimeout(debounceTimer);

    if (!query || query.length < 2) {
      emptyState.style.display = "block";
      [leagueSection, teamSection, venueSection].forEach((s) => s.reset());
      return;
    }

    emptyState.style.display = "none";
    debounceTimer = setTimeout(() => {
      leagueSection.load(query);
      teamSection.load(query);
      venueSection.load(query);
    }, 350);
  });

  return wrap;
}

export function SearchScreen({ onBack }) {
  const container = h("main", { className: "screen search-screen" });
  const allMode = buildAllMode();
  const playerMode = buildPlayerSearchMode();
  const allChip = chip("All", () => setMode("all"));
  const playersChip = chip("Players", () => setMode("players"));

  container.append(
    PageHeader({ title: "Search", onBack }),
    h("div", { className: "search-hero" }, [
      text("span", { className: "section-kicker" }, "EXPLORE"),
      text("h2", {}, "Find a league, club or player"),
      text("p", {}, "Search the football database instantly.")
    ]),
    h("div", { className: "search-tabs" }, [allChip, playersChip]),
    allMode, playerMode
  );
  playerMode.style.display = "none";

  function setMode(mode) {
    setChipActive(allChip, mode === "all");
    setChipActive(playersChip, mode === "players");
    allMode.style.display = mode === "all" ? "" : "none";
    playerMode.style.display = mode === "players" ? "" : "none";
  }
  setMode("all");
  return container;
}
