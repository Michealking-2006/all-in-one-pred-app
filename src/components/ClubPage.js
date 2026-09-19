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
      h("div", {  }, [
        h("img", { src: team.logo, alt: "",  }),
        text("div", {  }, team.name),
        text("div", { className: "mono eyebrow" }, `${(team.country || "").toUpperCase()}${team.founded ? ` \u00b7 FOUNDED ${team.founded}` : ""}`),
      ]),
    ];

    if (venue?.name) {
      nodes.push(
        h("div", {  }, [
          text("div", {  }, "HOME VENUE"),
          text("div", {  }, venue.name),
          venue.city ? text("div", {  }, `${venue.city}${venue.capacity ? ` \u00b7 ${venue.capacity.toLocaleString()} capacity` : ""}`) : null,
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
            ,
          },
          [
            h("img", { src: p.photo, alt: "",  }),
            h("div", {  }, [
              text("div", {  }, p.name),
              text("div", { className: "mono eyebrow",  }, (stat?.games?.position || "").toUpperCase()),
            ]),
            text("div", { className: "mono",  }, p.age ? `${p.age}y` : ""),
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
        return h("div", {  }, [
          text("div", { className: "mono eyebrow",  }, dateLabel.toUpperCase()),
          h("img", { src: opponent.logo, alt: "",  }),
          text("div", {  }, `${isHome ? "vs" : "@"} ${opponent.name}`),
          text("div", { className: "mono",  }, scoreLine),
        ]);
      })
    );
  });
}
