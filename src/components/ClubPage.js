import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getTeamById, getTeamSquad, getTeamFixtures, getTeamStatistics, getTeamLeagues } from "../api/footballApi.js";
import { buildSlug } from "../utils/slug.js";
import { getBestSeason, statusLabel } from "../utils/fixtures.js";
import { metaLine } from "../utils/ui.js";
import { navigate } from "../router.js";

// Team statistics need a league + season. `current=true` can list cups first,
// so prefer the domestic league entry.
function resolveContext(id) {
  return getTeamLeagues(id)
    .then((rows) => {
      const entry = rows.find((r) => r.league?.type === "League") || rows[0];
      return { leagueId: entry?.league?.id || null, season: getBestSeason(entry) };
    })
    .catch(() => ({ leagueId: null, season: null }));
}

export function ClubPage({ id, onBack }) {
  return createTabbedPage({
    title: "Club",
    onBack,
    tabs: [
      { id: "overview", label: "Overview", load: () => loadOverview(id) },
      { id: "matches", label: "Matches", load: () => loadMatches(id) },
      { id: "squad", label: "Squad", load: () => loadSquad(id) },
      { id: "stats", label: "Stats", load: () => loadStats(id) },
    ],
  });
}

function info(label, value) {
  return value != null && value !== "" ? h("div", { className: "entity-info-item" }, [text("span", {}, label), text("strong", {}, String(value))]) : null;
}

function statCard(label, value) {
  return h("div", { className: "card team-stat-card" }, [text("span", { className: "section-kicker" }, label), text("strong", { className: "mono" }, String(value))]);
}

function loadOverview(id) {
  return getTeamById(id).then((rows) => {
    const entry = rows[0];
    if (!entry) return emptyNode("Club not found.");
    const { team, venue } = entry;
    return h("div", {}, [
      h("section", { className: "entity-hero" }, [
        h("img", { className: "entity-logo", src: team.logo, alt: team.name }),
        text("h1", { className: "entity-title" }, team.name),
        metaLine([team.country, team.founded ? "Founded " + team.founded : null], "meta-line entity-meta"),
      ]),
      h("div", { className: "entity-info-grid" }, [
        info("Country", team.country), info("Founded", team.founded), info("Stadium", venue?.name),
        info("Capacity", venue?.capacity?.toLocaleString()), info("City", venue?.city),
      ]),
      venue?.id ? h("button", { className: "card info-card", onClick: () => navigate("/venue/" + buildSlug(venue.id, venue.name)) }, [
        text("div", { className: "section-kicker" }, "Home venue"),
        text("strong", { className: "info-card-title" }, venue.name),
        text("div", { className: "info-card-meta" }, venue.city || ""),
      ]) : null,
    ]);
  });
}

// `last` and `next` cannot be combined in one API call, so fetch both and merge.
function loadMatches(id) {
  return Promise.allSettled([getTeamFixtures(id, { last: 8 }), getTeamFixtures(id, { next: 8 })]).then((settled) => {
    const rows = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (!rows.length) {
      const failure = settled.find((r) => r.status === "rejected");
      if (failure) throw failure.reason;
      return emptyNode("No recent or upcoming fixtures are available.");
    }
    const seen = new Set();
    const fixtures = rows
      .filter((f) => (seen.has(f.fixture.id) ? false : seen.add(f.fixture.id)))
      .sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);

    return h("div", { className: "fixture-list" }, fixtures.map((f) => {
      const d = new Date(f.fixture.date);
      const score = f.goals?.home != null ? f.goals.home + "\u2013" + f.goals.away : "vs";
      return h("button", { className: "fixture-card", onClick: () => navigate("/match/" + f.fixture.id), "aria-label": "Open match" }, [
        h("div", { className: "fixture-meta" }, [
          text("span", { className: "eyebrow" }, d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })),
          text("span", { className: "fixture-time mono" }, statusLabel(f)),
        ]),
        h("div", { className: "fixture-teams" }, [
          h("div", { className: "fixture-team" }, [h("img", { className: "fixture-logo", src: f.teams.home.logo, alt: "" }), text("span", {}, f.teams.home.name)]),
          text("strong", { className: "mono fixture-vs" }, score),
          h("div", { className: "fixture-team away" }, [text("span", {}, f.teams.away.name), h("img", { className: "fixture-logo", src: f.teams.away.logo, alt: "" })]),
        ]),
      ]);
    }));
  });
}

const POSITION_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Attacker"];

// players/squads returns [{ team, players: [...] }] — one object holding the
// whole squad — with `position` and `number` directly on each player.
function loadSquad(id) {
  return getTeamSquad(id).then((rows) => {
    const players = rows[0]?.players || [];
    if (!players.length) return emptyNode("Squad data is not available for this team.");

    const byPosition = new Map();
    for (const p of players) {
      const key = p.position || "Other";
      if (!byPosition.has(key)) byPosition.set(key, []);
      byPosition.get(key).push(p);
    }
    const order = [...byPosition.keys()].sort((a, b) => {
      const ia = POSITION_ORDER.indexOf(a), ib = POSITION_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    return h("div", { className: "squad-groups" }, order.map((position) =>
      h("section", { className: "card squad-list" }, [
        text("div", { className: "section-kicker squad-group-title" }, position + "s"),
        ...byPosition.get(position).map((p) =>
          h("button", { className: "result-row squad-row", onClick: () => navigate("/player/" + buildSlug(p.id, p.name)), "aria-label": "Open " + p.name }, [
            h("img", { className: "scorer-photo", src: p.photo, alt: "" }),
            h("div", { className: "scorer-main" }, [
              text("strong", { className: "scorer-name" }, p.name),
              p.age ? text("div", { className: "scorer-club" }, p.age + " years") : null,
            ]),
            text("span", { className: "mono" }, p.number != null ? "#" + p.number : ""),
          ])
        ),
      ])
    ));
  });
}

// teams/statistics returns a single object (or [] when there is no data).
function loadStats(id) {
  return resolveContext(id)
    .then(({ leagueId, season }) => (leagueId ? getTeamStatistics(id, leagueId, season) : null))
    .then((data) => {
      if (data === null) return emptyNode("Team statistics need a league, and none was found for this club.");
      const s = Array.isArray(data) ? data[0] : data;
      if (!s || !s.fixtures) return emptyNode("Team statistics are not available for this season.");
      const played = s.fixtures.played?.total ?? "\u2013";
      return h("div", { className: "team-stat-grid" }, [
        statCard("Form", (s.form || "\u2013").slice(-10)),
        statCard("Matches played", played),
        statCard("Wins", s.fixtures.wins?.total ?? "\u2013"),
        statCard("Draws", s.fixtures.draws?.total ?? "\u2013"),
        statCard("Losses", s.fixtures.loses?.total ?? "\u2013"),
        statCard("Goals for", s.goals?.for?.total?.total ?? "\u2013"),
        statCard("Goals against", s.goals?.against?.total?.total ?? "\u2013"),
        statCard("Clean sheets", s.clean_sheet?.total ?? "\u2013"),
      ]);
    });
}
