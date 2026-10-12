import { h, text } from "../utils/h.js";
import { isLive, isFinished, statusLabel } from "../utils/fixtures.js";
import { setStarState } from "../utils/ui.js";

function teamRow(team, goal, dim) {
  return h("div", { className: "ios-team-row" }, [
    team?.logo ? h("img", { className: "ios-team-logo", src: team.logo, alt: "", loading: "lazy", width: "18", height: "18" }) : h("span", { className: "ios-team-logo" }),
    text("span", { className: "team-name" }, team?.name || "TBD"),
    text("b", { className: "mono ios-score" + (dim ? " muted-score" : "") }, goal ?? "\u2013"),
  ]);
}

// One fixture row (Home + Favourites). The star updates itself in place: the
// caller's onToggleFavorite(id) must return the new favourite state.
export function MatchRow(fx, { isFavorite, onOpen, onToggleFavorite }) {
  const fixture = fx.fixture || {};
  const short = fixture.status?.short;
  const live = isLive(short);
  const finished = isFinished(short);
  const goals = fx.goals || {};
  const label = (fx.teams?.home?.name || "Home") + " vs " + (fx.teams?.away?.name || "Away");

  const star = h("button", {
    type: "button",
    className: "ios-favorite" + (isFavorite ? " selected" : ""),
    "aria-label": isFavorite ? "Remove favourite" : "Add favourite",
    "aria-pressed": !!isFavorite,
    onClick: (event) => {
      event.stopPropagation();
      setStarState(star, onToggleFavorite(fixture.id));
    },
  }, [h("i", { "data-lucide": "star", fill: isFavorite ? "currentColor" : "none" })]);

  return h("article", { className: "ios-match-row" + (live ? " is-live" : "") }, [
    h("button", {
      type: "button",
      className: "match-main ios-match-main",
      onClick: () => onOpen(fixture.id),
      "aria-label": label,
    }, [
      h("div", { className: "ios-match-time" }, [
        live
          ? h("span", { className: "ios-live-status" }, [h("span", { className: "live-dot" }), text("span", {}, statusLabel(fx))])
          : text("span", {}, statusLabel(fx)),
      ]),
      h("div", { className: "ios-match-teams" }, [
        teamRow(fx.teams?.home, goals.home, finished),
        teamRow(fx.teams?.away, goals.away, finished),
      ]),
    ]),
    star,
  ]);
}
