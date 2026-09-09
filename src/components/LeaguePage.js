import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { Skeleton } from "./Skeleton.js";
import { getLeagueById, getStandings, getUpcomingFixtures } from "../api/footballApi.js";

const TABS = ["overview", "standings", "fixtures"];

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function skeletonBlock() {
  return h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, [
    Skeleton({ style: { width: "100%", height: "40px", borderRadius: "8px" } }),
    Skeleton({ style: { width: "100%", height: "40px", borderRadius: "8px" } }),
    Skeleton({ style: { width: "100%", height: "40px", borderRadius: "8px" } }),
  ]);
}

// props: { id, onBack }
export function LeaguePage({ id, onBack }) {
  const container = h("div", { className: "screen" });
  container.appendChild(PageHeader({ title: "League", onBack }));

  const tabBar = h("div", { style: { display: "flex", borderBottom: "0.5px solid var(--border)" } });
  const panel = h("div", { style: { padding: "20px 18px" } });
  container.appendChild(tabBar);
  container.appendChild(panel);

  let activeTab = "overview";
  let season = null; // resolved from the base league fetch, needed for standings/fixtures
  const tabCache = {}; // tab name -> rendered content node, avoids refetching on revisit

  function setActiveTab(tab) {
    activeTab = tab;
    [...tabBar.children].forEach((btn, i) => {
      const isActive = TABS[i] === tab;
      btn.style.color = isActive ? "var(--text)" : "var(--text-muted)";
      btn.style.borderBottomColor = isActive ? "var(--accent)" : "transparent";
    });
    renderTab(tab);
  }

  TABS.forEach((tab) => {
    const btn = h(
      "button",
      {
        onClick: () => setActiveTab(tab),
        style: { flex: "1", padding: "11px 0", border: "none", background: "none", fontSize: "13px", fontWeight: "500", borderBottom: "2px solid transparent", color: "var(--text-muted)" },
      },
      tab.charAt(0).toUpperCase() + tab.slice(1)
    );
    tabBar.appendChild(btn);
  });

  function renderTab(tab) {
    panel.innerHTML = "";
    if (tabCache[tab]) {
      panel.appendChild(tabCache[tab]);
      return;
    }
    panel.appendChild(skeletonBlock());
    loadTab(tab);
  }

  function loadTab(tab) {
    if (tab === "overview") return loadOverview();
    if (tab === "standings") return loadStandings();
    if (tab === "fixtures") return loadFixtures();
  }

  function paint(tab, node) {
    tabCache[tab] = node;
    if (activeTab === tab) {
      panel.innerHTML = "";
      panel.appendChild(node);
      refreshIcons();
    }
  }

  function errorNode(message) {
    return text("div", { style: { textAlign: "center", color: "var(--danger)", fontSize: "13px", padding: "30px 0" } }, message);
  }

  function loadOverview() {
    getLeagueById(id)
      .then((results) => {
        const entry = results[0];
        if (!entry) return paint("overview", text("div", { style: { textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "30px 0" } }, "League not found."));

        const { league, country, seasons } = entry;
        const current = (seasons || []).find((s) => s.current);
        season = current?.year || new Date().getFullYear();

        const node = h("div", {}, [
          h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" } }, [
            h("img", { src: league.logo, alt: "", style: { width: "64px", height: "64px", objectFit: "contain", marginBottom: "10px" } }),
            text("div", { style: { fontWeight: "700", fontSize: "18px", marginBottom: "4px", textAlign: "center" } }, league.name),
            text("div", { className: "mono eyebrow" }, `${(country?.name || "").toUpperCase()} \u00b7 ${(league.type || "").toUpperCase()}`),
          ]),
          current
            ? h("div", { style: { background: "var(--surface)", borderRadius: "10px", padding: "14px", textAlign: "center" } }, [
                text("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" } }, "CURRENT SEASON"),
                text("div", { className: "mono", style: { fontSize: "16px", fontWeight: "600" } }, String(current.year)),
              ])
            : null,
        ]);
        paint("overview", node);
      })
      .catch(() => paint("overview", errorNode("Couldn't load this league \u2014 check your connection.")));
  }

  function loadStandings() {
    // Standings needs a season, which comes from the overview fetch — if the
    // user opens this tab first, resolve overview's league/season first.
    const ensureSeason = season ? Promise.resolve() : getLeagueById(id).then((r) => {
      const current = (r[0]?.seasons || []).find((s) => s.current);
      season = current?.year || new Date().getFullYear();
    });

    ensureSeason
      .then(() => getStandings(id, season))
      .then((results) => {
        const table = results[0]?.league?.standings?.[0];
        if (!table || table.length === 0) return paint("standings", text("div", { style: { textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "30px 0" } }, "No standings available for this season."));

        const rows = table.map((row) =>
          h("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: "0.5px solid var(--border-soft)" } }, [
            text("div", { className: "mono", style: { width: "18px", fontSize: "12px", color: "var(--text-muted)" } }, row.rank),
            h("img", { src: row.team.logo, alt: "", style: { width: "20px", height: "20px", objectFit: "contain", flexShrink: "0" } }),
            text("div", { style: { flex: "1", fontSize: "13px", fontWeight: "500" } }, row.team.name),
            text("div", { className: "mono", style: { width: "24px", textAlign: "right", fontSize: "12px", color: "var(--text-muted)" } }, row.all.played),
            text("div", { className: "mono", style: { width: "32px", textAlign: "right", fontSize: "13px", fontWeight: "700" } }, row.points),
          ])
        );

        const header = h("div", { className: "mono eyebrow", style: { display: "flex", alignItems: "center", gap: "10px", paddingBottom: "6px", borderBottom: "0.5px solid var(--border)" } }, [
          text("div", { style: { width: "18px" } }, "#"),
          text("div", { style: { width: "20px" } }, ""),
          text("div", { style: { flex: "1" } }, "TEAM"),
          text("div", { style: { width: "24px", textAlign: "right" } }, "P"),
          text("div", { style: { width: "32px", textAlign: "right" } }, "PTS"),
        ]);

        paint("standings", h("div", {}, [header, ...rows]));
      })
      .catch(() => paint("standings", errorNode("Couldn't load standings \u2014 check your connection.")));
  }

  function loadFixtures() {
    const ensureSeason = season ? Promise.resolve() : getLeagueById(id).then((r) => {
      const current = (r[0]?.seasons || []).find((s) => s.current);
      season = current?.year || new Date().getFullYear();
    });

    ensureSeason
      .then(() => getUpcomingFixtures(id, season, 8))
      .then((fixtures) => {
        if (fixtures.length === 0) return paint("fixtures", text("div", { style: { textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "30px 0" } }, "No upcoming fixtures found."));

        const rows = fixtures.map((f) => {
          const date = new Date(f.fixture.date);
          const dateLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return h("div", { style: { padding: "12px 0", borderBottom: "0.5px solid var(--border-soft)" } }, [
            text("div", { className: "mono eyebrow", style: { marginBottom: "6px" } }, `${dateLabel.toUpperCase()} \u00b7 ${f.fixture.venue?.name || ""}`),
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
              h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
                h("img", { src: f.teams.home.logo, alt: "", style: { width: "18px", height: "18px", objectFit: "contain" } }),
                text("span", { style: { fontSize: "13px" } }, f.teams.home.name),
              ]),
              text("span", { style: { fontSize: "11px", color: "var(--text-muted)" } }, "vs"),
              h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
                text("span", { style: { fontSize: "13px" } }, f.teams.away.name),
                h("img", { src: f.teams.away.logo, alt: "", style: { width: "18px", height: "18px", objectFit: "contain" } }),
              ]),
            ]),
          ]);
        });

        paint("fixtures", h("div", {}, rows));
      })
      .catch(() => paint("fixtures", errorNode("Couldn't load fixtures \u2014 check your connection.")));
  }

  setActiveTab("overview");
  return container;
}
