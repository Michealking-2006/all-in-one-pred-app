import { h, text } from "../utils/h.js";
import { getFixturesByDate, peekFixturesByDate } from "../api/footballApi.js";
import { localDateISO, groupByLeague } from "../utils/fixtures.js";
import { DateStrip } from "./DateStrip.js";
import { MatchRow } from "./MatchRow.js";
import { metaLine } from "../utils/ui.js";
import { SkeletonMatchList } from "./Skeleton.js";

function leagueSection(group, props) {
  const { league, items } = group;
  return h("section", { className: "ios-league-section" }, [
    h("header", { className: "ios-league-header" }, [
      h("div", { className: "ios-league-title" }, [
        league.logo ? h("img", { className: "ios-league-logo", src: league.logo, alt: "", loading: "lazy", width: "18", height: "18" }) : h("span", { className: "ios-league-dot" }),
        metaLine([league.name || "Football", league.country], "meta-line ios-league-name"),
      ]),
      text("span", { className: "mono ios-league-count" }, String(items.length)),
    ]),
    h("div", { className: "ios-match-list" },
      items.map((fx) => MatchRow(fx, {
        isFavorite: (props.favoriteMatchIds || []).includes(fx.fixture?.id),
        onOpen: props.onOpenMatch,
        onToggleFavorite: props.onToggleFavorite,
      }))
    ),
  ]);
}

export function HomeScreen(props) {
  const offset = props.selectedDayOffset || 0;
  const date = localDateISO(offset);

  const content = h("div", { className: "ios-home-content" });
  const root = h("main", { className: "screen home-screen ios-home" }, [
    h("header", { className: "home-header ios-large-header" }, [
      h("div", { className: "home-title-wrap", "aria-label": "Scoutwave" }, [
        h("img", { className: "home-logo logo-on-light", src: "/src/assets/scoutwave-wordmark.png", alt: "", width: "181", height: "28", decoding: "async" }),
        h("img", { className: "home-logo logo-on-dark", src: "/src/assets/scoutwave-wordmark-dark.png", alt: "", width: "181", height: "28", decoding: "async" }),
      ]),
      h("div", { className: "header-actions" }, [
        h("button", { className: "header-icon", onClick: props.onOpenSearch, "aria-label": "Search" }, [h("i", { "data-lucide": "search" })]),
        h("button", { className: "header-icon", onClick: props.onOpenProfile, "aria-label": "Profile" }, [h("i", { "data-lucide": "circle-user-round" })]),
      ]),
    ]),
    DateStrip({ selectedOffset: offset, onSelectDay: props.onSelectDay }),
    content,
  ]);

  function showRows(rows) {
    content.innerHTML = "";
    content.removeAttribute("aria-busy");
    if (!rows.length) {
      content.appendChild(h("div", { className: "empty-state" }, "No matches scheduled for this day."));
      return;
    }
    groupByLeague(rows).forEach((group) => content.appendChild(leagueSection(group, props)));
  }

  function showError(error) {
    content.innerHTML = "";
    content.removeAttribute("aria-busy");
    content.appendChild(h("div", { className: "error-state" }, [
      text("p", {}, error?.message || "Football matches could not be loaded."),
      h("button", { type: "button", className: "secondary-button", onClick: load }, "Try again"),
    ]));
  }

  function load() {
    content.innerHTML = "";
    content.setAttribute("aria-busy", "true");
    content.append(SkeletonMatchList({ leagues: 2, rows: 3 }));
    getFixturesByDate(date).then(showRows).catch(showError);
  }

  // Fresh cache -> paint synchronously (no flash when the app re-renders).
  const cached = peekFixturesByDate(date);
  if (cached) showRows(cached);
  else load();

  return root;
}
