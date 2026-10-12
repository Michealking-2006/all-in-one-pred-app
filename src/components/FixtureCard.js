import { h, text } from "../utils/h.js";
import { isLive, statusLabel, formatDay, resultFor } from "../utils/fixtures.js";
import { resultBadge } from "../utils/sections.js";
import { metaLine } from "../utils/ui.js";
import { navigate } from "../router.js";

// One fixture as a tappable card. Pass `teamId` to show a W/D/L badge from that
// team's point of view; `showLeague` to add the competition line.
export function FixtureCard(fx, { teamId = null, showLeague = false, showRound = false } = {}) {
  const live = isLive(fx.fixture?.status?.short);
  const goals = fx.goals || {};
  const score = goals.home != null ? goals.home + "\u2013" + goals.away : "vs";
  const result = teamId ? resultFor(fx, teamId) : null;
  const home = fx.teams?.home || {};
  const away = fx.teams?.away || {};

  return h("button", {
    type: "button", className: "fixture-card" + (live ? " is-live" : ""),
    onClick: () => navigate("/match/" + fx.fixture.id),
    "aria-label": (home.name || "Home") + " vs " + (away.name || "Away"),
  }, [
    h("div", { className: "fixture-meta" }, [
      text("span", { className: "eyebrow" }, formatDay(fx.fixture?.date)),
      result ? resultBadge(result) : text("span", { className: "fixture-time mono" + (live ? " live" : "") }, statusLabel(fx)),
    ]),
    h("div", { className: "fixture-teams" }, [
      h("div", { className: "fixture-team" }, [home.logo ? h("img", { className: "fixture-logo", src: home.logo, alt: "" }) : null, text("span", {}, home.name || "TBD")]),
      text("strong", { className: "mono fixture-vs" }, score),
      h("div", { className: "fixture-team away" }, [text("span", {}, away.name || "TBD"), away.logo ? h("img", { className: "fixture-logo", src: away.logo, alt: "" }) : null]),
    ]),
    showLeague ? metaLine([fx.league?.name, fx.league?.round], "meta-line fixture-league")
      : showRound && fx.league?.round ? metaLine([fx.league.round], "meta-line fixture-league") : null,
  ]);
}

// Groups fixtures under day headings: [{ label, items }]
export function groupByDay(fixtures) {
  const groups = [];
  for (const fx of fixtures) {
    const label = formatDay(fx.fixture?.date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(fx);
    else groups.push({ label, items: [fx] });
  }
  return groups;
}
