import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getTeamById, getTeamSquad, getTeamFixtures } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

// props: { id, onBack }
export function ClubPage({ id, onBack }) {
  return createTabbedPage({
    title: "Club",
    onBack,
    tabs: [
      { id: "overview", label: "Overview", load: () => loadOverview(id) },
      { id: "squad", label: "Squad", load: () => loadSquad(id) },
      { id: "form", label: "Form", load: () => loadForm(id) },
    ],
  });
}

function loadOverview(id) {
  return getTeamById(id).then((results) => {
    const entry = results[0];
    if (!entry) return emptyNode("Club not found.");
    const { team, venue } = entry;

    const nodes = [
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" } }, [
        h("img", { src: team.logo, alt: "", style: { width: "64px", height: "64px", objectFit: "contain", marginBottom: "10px" } }),
        text("div", { style: { fontWeight: "700", fontSize: "18px", marginBottom: "4px", textAlign: "center" } }, team.name),
        text("div", { className: "mono eyebrow" }, `${(team.country || "").toUpperCase()}${team.founded ? ` \u00b7 FOUNDED ${team.founded}` : ""}`),
      ]),
    ];

    if (venue?.name) {
      nodes.push(
        h("div", { style: { background: "var(--surface)", borderRadius: "10px", padding: "14px" } }, [
          text("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" } }, "HOME VENUE"),
          text("div", { style: { fontSize: "14px", fontWeight: "600", marginBottom: "2px" } }, venue.name),
          venue.city ? text("div", { style: { fontSize: "12px", color: "var(--text-dim)" } }, `${venue.city}${venue.capacity ? ` \u00b7 ${venue.capacity.toLocaleString()} capacity` : ""}`) : null,
        ])
      );
    }

    return h("div", {}, nodes);
  });
}

function loadSquad(id) {
  return getTeamSquad(id).then((players) => {
    if (players.length === 0) return emptyNode("Squad list not available.");
    return h(
      "div",
      {},
      players.map((entry) => {
        const p = entry.player;
        const stat = entry.statistics?.[0];
        return h(
          "div",
          {
            role: "button",
            tabindex: "0",
            onClick: () => navigate(`/player/${buildSlug(p.id, p.name)}`),
            style: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "0.5px solid var(--border-soft)" },
          },
          [
            h("img", { src: p.photo, alt: "", style: { width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", flexShrink: "0" } }),
            h("div", { style: { flex: "1", minWidth: "0" } }, [
              text("div", { style: { fontSize: "13px", fontWeight: "500" } }, p.name),
              text("div", { className: "mono eyebrow", style: { marginTop: "2px" } }, (stat?.games?.position || "").toUpperCase()),
            ]),
            text("div", { className: "mono", style: { fontSize: "12px", color: "var(--text-muted)" } }, p.age ? `${p.age}y` : ""),
          ]
        );
      })
    );
  });
}

function loadForm(id) {
  return getTeamFixtures(id, { last: 6 }).then((fixtures) => {
    if (fixtures.length === 0) return emptyNode("No recent fixtures found.");
    return h(
      "div",
      {},
      fixtures.map((f) => {
        const date = new Date(f.fixture.date);
        const dateLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const isHome = f.teams.home.id === id;
        const opponent = isHome ? f.teams.away : f.teams.home;
        const scoreLine = f.goals.home != null ? `${f.goals.home} \u2013 ${f.goals.away}` : "\u2014";
        return h("div", { style: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "0.5px solid var(--border-soft)" } }, [
          text("div", { className: "mono eyebrow", style: { width: "48px", flexShrink: "0" } }, dateLabel.toUpperCase()),
          h("img", { src: opponent.logo, alt: "", style: { width: "22px", height: "22px", objectFit: "contain", flexShrink: "0" } }),
          text("div", { style: { flex: "1", fontSize: "13px" } }, `${isHome ? "vs" : "@"} ${opponent.name}`),
          text("div", { className: "mono", style: { fontSize: "13px", fontWeight: "700" } }, scoreLine),
        ]);
      })
    );
  });
}
