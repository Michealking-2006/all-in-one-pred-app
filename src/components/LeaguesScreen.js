import { h, text } from "../utils/h.js";
import { SkeletonList } from "./Skeleton.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";
import { safeMessage } from "../utils/errors.js";
import { appendInPieces } from "../utils/chunked.js";
import { loadAllLeagues, filterLeagues, groupByCountry, popularFrom } from "../utils/leagueList.js";

const TYPES = [["all", "All"], ["League", "Leagues"], ["Cup", "Cups"]];

// Navigate by id (not name): names collide across countries ("Premier League",
// "Serie A", "Bundesliga"), so a name slug can open the wrong competition.
// `detail` is the small line under the name: the country, or the kind of competition inside a country group.
function leagueRow(entry, detail) {
  const { league, country } = entry;
  const small = detail === "type" ? (league.type === "Cup" ? "Cup" : "League") : [country?.name, league.type === "Cup" ? "Cup" : ""].filter(Boolean).join(" · ");
  return h("button", { className: "league-row", onClick: () => navigate("/league/" + buildSlug(league.id, league.name)), "aria-label": "Open " + league.name }, [
    h("img", { src: league.logo, alt: "", className: "league-logo", loading: "lazy", decoding: "async" }),
    h("span", { className: "league-row-copy" }, [text("strong", {}, league.name), text("small", {}, small)]),
    h("i", { "data-lucide": "chevron-right", "aria-hidden": "true" }),
  ]);
}

function countryGroup(group) {
  return h("section", { className: "league-country" }, [
    h("div", { className: "league-country-head" }, [
      group.flag ? h("img", { src: group.flag, alt: "", className: "league-flag", loading: "lazy", decoding: "async", onError: (e) => e.target.remove() }) : null,
      text("span", {}, group.country),
      text("span", { className: "league-country-count" }, String(group.items.length)),
    ].filter(Boolean)),
    h("div", { className: "league-list" }, group.items.map((e) => leagueRow(e, "type"))),
  ]);
}

const plural = (n, one, many) => n.toLocaleString() + " " + (n === 1 ? one : many);

export function LeaguesScreen() {
  const container = h("main", { className: "screen leagues-screen" });
  const input = h("input", { className: "league-search-input", type: "search", placeholder: "Search leagues or countries", "aria-label": "Search leagues", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
  const status = h("div", { className: "league-count", "aria-live": "polite" });
  const body = h("section", { className: "league-body" });
  let all = null;       // every league, once loaded
  let type = "all";     // all | League | Cup
  let renderSeq = 0;    // a newer render cancels the pieces of the older one still being drawn

  const buttons = TYPES.map(([value, label]) =>
    h("button", { type: "button", className: "seg-button" + (value === type ? " active" : ""), "aria-pressed": String(value === type), onClick: () => {
      if (type === value) return;
      type = value;
      buttons.forEach((b, i) => { const on = TYPES[i][0] === type; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
      render();
    } }, label));
  const filterBar = h("div", { className: "seg-wrap league-filter" }, [h("div", { className: "seg" }, buttons)]);

  container.append(
    h("header", { className: "page-intro" }, [
      text("span", { className: "section-kicker" }, "Competitions"),
      text("h1", {}, "Leagues"),
      text("p", {}, "Every league and cup, by country. Follow standings, fixtures and scoring leaders."),
    ]),
    h("div", { className: "search-shell" }, [h("i", { "data-lucide": "search", className: "search-icon" }), input]),
    filterBar,
    status,
    body
  );

  function showLoading() {
    status.textContent = "";
    filterBar.hidden = true;
    body.replaceChildren(SkeletonList({ rows: 8 }));
  }

  function showError(err) {
    status.textContent = "";
    filterBar.hidden = true;
    body.replaceChildren(h("div", { className: "error-state" }, [
      text("p", {}, safeMessage(err, "Unable to load football data.")),
      h("button", { type: "button", className: "secondary-button", onClick: load }, "Try again"),
    ]));
  }

  function render() {
    if (!all) return;
    const seq = ++renderSeq;
    const isStale = () => seq !== renderSeq;
    const query = input.value.trim();
    filterBar.hidden = false;
    const found = filterLeagues(all, { query, type });
    body.replaceChildren();

    if (!found.length) {
      status.textContent = "";
      body.append(text("div", { className: "empty-state" }, query ? "No leagues match \u201C" + query + "\u201D." : "No competitions of this kind right now."));
      return;
    }

    if (query) {
      // Search: one flat list, best matches first, each row says which country it belongs to.
      status.textContent = plural(found.length, "result", "results");
      const list = h("div", { className: "league-list" });
      body.append(list);
      appendInPieces(list, found, (e) => leagueRow(e), { first: 24, batch: 24, isStale });
      return;
    }

    const countries = groupByCountry(found);
    status.textContent = plural(found.length, type === "Cup" ? "cup" : type === "League" ? "league" : "competition", type === "Cup" ? "cups" : type === "League" ? "leagues" : "competitions") + " in " + plural(countries.length, "country", "countries");

    const popular = type === "all" ? popularFrom(all) : [];
    if (popular.length) {
      body.append(h("section", { className: "league-popular" }, [
        text("div", { className: "section-kicker league-section-kicker" }, "Popular"),
        h("div", { className: "league-list" }, popular.map((e) => leagueRow(e))),
      ]));
    }
    const wrap = h("div", { className: "league-all" });
    body.append(text("div", { className: "section-kicker league-section-kicker" }, "By country"), wrap);
    appendInPieces(wrap, countries, countryGroup, { first: 8, batch: 8, isStale });
  }

  function load() {
    showLoading();
    loadAllLeagues().then((list) => { all = list; render(); }).catch(showError);
  }
  load();

  let timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(render, 90);
  });
  return container;
}
