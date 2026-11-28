import { h, text } from "../utils/h.js";
import { searchTeams } from "../api/footballApi.js";
import { crestColors, clubFromTeam } from "../clubColors.js";
import { safeMessage } from "../utils/errors.js";

// "Find any club": a search box over the football data service's clubs (the four quick picks stay where they are, this
// is for everyone else). Choosing a result reads the crest's colours, then hands back a ready club: onPick(club).
//   selectedId   the id of the club already chosen (gets a tick)
//   onPick(club) a club as clubFromTeam() makes it
const MIN_CHARS = 3; // the service refuses shorter searches
const DELAY_MS = 350;
const MAX_ROWS = 12;
const memo = new Map(); // query -> clubs, for this visit (typing and deleting costs no extra requests)

const crestImg = (team) => {
  const img = h("img", { className: "search-result-image", src: team.logo, alt: "", width: "36", height: "36", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.replaceWith(h("div", { className: "search-result-image" })), { once: true });
  return img;
};

export function ClubSearch({ selectedId = null, onPick, label = "Can't see your club? Search for it" }) {
  let counter = 0, timer = 0, picking = false;
  const input = h("input", { type: "search", className: "club-search-input", placeholder: "Search any club", autocomplete: "off", autocapitalize: "words", spellcheck: "false", enterkeyhint: "search", "aria-label": "Search for a club" });
  const results = h("div", { className: "club-search-results", "aria-live": "polite" });

  const note = (message, cls = "") => results.replaceChildren(h("p", { className: "club-search-note " + cls, role: cls ? "alert" : undefined }, message));

  function show(rows) {
    if (!rows.length) { note("No clubs found. Check the spelling, or try a shorter name."); return; }
    results.replaceChildren(h("div", { className: "search-results-group club-search-list" }, rows.map((row) => {
      const chosen = ("t-" + row.team.id) === (typeof selectedId === "function" ? selectedId() : selectedId);
      return h("button", { type: "button", className: "search-result-row club-search-row", "data-team": String(row.team.id), onClick: (event) => choose(row, event.currentTarget) }, [
        crestImg(row.team),
        h("div", { className: "search-result-copy" }, [
          text("div", { className: "search-result-title" }, row.team.name),
          text("div", { className: "search-result-subtitle" }, row.team.country || ""),
        ]),
        chosen ? h("i", { "data-lucide": "check" }) : null,
      ]);
    })));
  }

  async function choose(row, el) {
    if (picking) return;
    picking = true;
    el?.classList.add("is-busy");
    el?.setAttribute("aria-busy", "true");
    try {
      const colors = await crestColors(row.team.logo, row.team.name);
      const club = clubFromTeam(row.team, colors);
      if (club) onPick(club);
    } finally {
      picking = false;
      el?.classList.remove("is-busy");
      el?.removeAttribute("aria-busy");
    }
  }

  async function run(query) {
    const mine = ++counter;
    if (memo.has(query)) { show(memo.get(query)); return; }
    results.replaceChildren(h("div", { className: "club-search-loading" }, [h("span", { className: "spinner", "aria-hidden": "true" }), text("span", {}, "Searching clubs")]));
    try {
      const rows = (await searchTeams(query)).filter((r) => r?.team?.id && r.team.name && !r.team.national).slice(0, MAX_ROWS);
      memo.set(query, rows);
      if (mine === counter) show(rows);
    } catch (error) {
      if (mine === counter) note(safeMessage(error, "Clubs couldn't be searched right now. Try again in a moment."), "is-error");
    }
  }

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    const query = input.value.trim();
    counter++; // an older answer must not replace what is wanted now
    if (!query) { results.replaceChildren(); return; }
    if (query.length < MIN_CHARS) { note("Type at least " + MIN_CHARS + " letters."); return; }
    timer = window.setTimeout(() => run(query.toLowerCase()), DELAY_MS);
  });
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); window.clearTimeout(timer); const q = input.value.trim(); if (q.length >= MIN_CHARS) run(q.toLowerCase()); } });

  return h("section", { className: "club-search", "aria-label": "Find a club" }, [
    text("div", { className: "club-search-label" }, label),
    h("div", { className: "club-search-field" }, [h("i", { "data-lucide": "search", "aria-hidden": "true" }), input]),
    results,
  ]);
}
