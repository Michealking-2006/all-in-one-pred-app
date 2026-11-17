// Season recap: how the club's season went, as a card in its colours that can be shared as an image.
import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { store } from "../store.js";
import { navigate } from "../router.js";
import { pills, seasonPicker } from "../utils/ui.js";
import { safeMessage } from "../utils/errors.js";
import { hubClubs } from "../hub.js";
import { loadRecap, seasonLabel, ordinal } from "../recap.js";
import { seasonFor } from "../myClub.js";
import { clubById, CLUBS } from "../clubs.js";
import { openShareSheet } from "./ShareSheet.js";

const stat = (value, label) => h("div", { className: "rc-stat" }, [text("strong", {}, String(value)), text("span", {}, label)]);
const note = (message, cls = "muted-copy") => text("p", { className: cls + " hub-note" }, message);

export function recapCard(club, season, r, inProgress) {
  const { record } = r;
  const rows = [
    h("div", { className: "rc-head" }, [
      club.logo ? h("img", { className: "rc-crest", src: club.logo, alt: "", width: "64", height: "64" }) : null,
      h("div", {}, [text("strong", { className: "rc-name" }, club.name), text("span", { className: "rc-season" }, seasonLabel(season) + (inProgress ? " so far" : " season"))]),
    ]),
    h("div", { className: "rc-wdl" }, [stat(record.won, "Won"), stat(record.drawn, "Drawn"), stat(record.lost, "Lost")]),
    h("div", { className: "rc-grid" }, [stat(record.played, "Played"), stat(record.goalsFor, "Goals scored"), stat(record.goalsAgainst, "Goals conceded"), stat(record.cleanSheets, "Clean sheets")]),
  ];
  if (r.standing) rows.push(h("div", { className: "rc-line" }, [text("strong", {}, `${inProgress ? "Currently" : "Finished"} ${ordinal(r.standing.rank)}`), text("span", {}, `${r.standing.points} points in the ${r.league.name}`)]));
  if (r.best) rows.push(h("div", { className: "rc-line" }, [text("span", {}, "Best result"), text("strong", {}, `${r.best.gf}\u2013${r.best.ga} ${r.best.home ? "v" : "at"} ${r.best.opponent.name}`)]));
  if (r.topScorer?.goals) rows.push(h("div", { className: "rc-line rc-scorer" }, [r.topScorer.photo ? h("img", { src: r.topScorer.photo, alt: "", width: "40", height: "40", className: "rc-photo" }) : null, h("div", {}, [text("span", {}, `Top scorer in the ${r.league.name}`), text("strong", {}, `${r.topScorer.name}, ${r.topScorer.goals} goals`)])]));
  if (r.unbeaten >= 3) rows.push(h("div", { className: "rc-line" }, [text("span", {}, "Longest unbeaten run"), text("strong", {}, r.unbeaten + " games")]));
  return h("section", { className: "recap-card", style: { "--cw-a": club.primary || "#d50000", "--cw-b": club.secondary || "#ff8a00" } }, rows);
}

export function RecapScreen({ onBack }) {
  const body = h("div", { className: "recap-body" });
  const root = h("main", { className: "screen recap-screen" }, [PageHeader({ title: "Season recap", onBack }), body]);
  let clubs = [], club = null, season = seasonFor(), token = 0;

  async function drawRecap() {
    const mine = ++token, panel = body.querySelector(".recap-panel");
    panel.replaceChildren(note("Working out your season\u2026"));
    try {
      const r = await loadRecap({ teamId: club.id }, season);
      if (mine !== token) return;
      panel.replaceChildren();
      if (!r.record.played) { panel.appendChild(note("No finished matches found for " + club.name + " in " + seasonLabel(season) + ".")); return; }
      const month = new Date().getMonth(), inProgress = season === seasonFor() && (month >= 7 || month <= 4);
      const themed = CLUBS.find((c) => c.teamId === club.id) || { primary: "#d50000", secondary: "#ff8a00" };
      const view = { name: club.name, logo: club.logo, primary: themed.primary, secondary: themed.secondary };
      panel.appendChild(recapCard(view, season, r, inProgress));
      panel.appendChild(h("button", { type: "button", className: "primary-button", onClick: () => openShareSheet("recap", { name: `${club.name} ${seasonLabel(season)}`, club: view, season, summary: r, inProgress }) }, "Share my recap"));
    } catch (error) { if (mine === token) panel.replaceChildren(note(safeMessage(error, "Couldn't load the season."), "async-error-state")); }
  }

  function drawPage() {
    body.replaceChildren();
    if (!club) {
      body.appendChild(h("section", { className: "card diary-empty" }, [text("strong", {}, "Pick a club"), text("p", {}, "Choose the club you support, or star a club, to see its season recap."), h("button", { type: "button", className: "primary-button", onClick: () => navigate("/appearance") }, "Pick my club")]));
      return;
    }
    if (clubs.length > 1) body.appendChild(pills(clubs.map((c) => ({ id: String(c.id), label: c.name })), (id) => { club = clubs.find((c) => String(c.id) === id); drawRecap(); }, String(club.id)).node);
    const options = [0, 1, 2].map((i) => ({ value: seasonFor() - i, label: seasonLabel(seasonFor() - i) }));
    body.appendChild(seasonPicker({ options, value: season, onChange: (v) => { season = Number(v); drawRecap(); } }));
    body.appendChild(h("div", { className: "recap-panel" }));
    drawRecap();
  }

  body.appendChild(note("Loading\u2026"));
  hubClubs(store.getState()).then((list) => { clubs = list; club = list[0] || null; drawPage(); }).catch(() => body.replaceChildren(note("Couldn't load your clubs.", "async-error-state")));
  return root;
}
