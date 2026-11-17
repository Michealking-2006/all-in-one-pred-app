// Match diary: every game you went to or watched, with your rating and note. Reached from Profile and from a match page.
import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { navigate } from "../router.js";
import { segmented } from "../utils/ui.js";
import { loadDiary, diaryStats, groupByMonth } from "../diary.js";

const stat = (value, label) => h("div", { className: "diary-stat" }, [text("strong", {}, String(value)), text("span", {}, label)]);
const starsText = (n) => "\u2605".repeat(n) + "\u2606".repeat(5 - n);

function entryCard(entry, reload) {
  const m = entry.match, d = new Date(m.date);
  const when = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return h("article", { className: "diary-card card" }, [
    h("button", { type: "button", className: "diary-card-main", "aria-label": `${m.home.name} ${m.goals.home ?? ""} ${m.goals.away ?? ""} ${m.away.name}. Open match.`, onClick: () => navigate("/match/" + entry.id) }, [
      h("span", { className: "diary-teams" }, [
        m.home.logo ? h("img", { src: m.home.logo, alt: "", width: "28", height: "28", loading: "lazy" }) : null,
        text("strong", {}, `${m.goals.home ?? "\u2013"}\u2013${m.goals.away ?? "\u2013"}`),
        m.away.logo ? h("img", { src: m.away.logo, alt: "", width: "28", height: "28", loading: "lazy" }) : null,
      ]),
      text("span", { className: "diary-names" }, `${m.home.name} v ${m.away.name}`),
      m.league ? text("span", { className: "diary-meta" }, m.league) : null,
      when ? text("span", { className: "diary-meta" }, when) : null,
    ]),
    h("div", { className: "diary-card-side" }, [
      text("span", { className: "diary-kind-badge " + entry.kind }, entry.kind === "attended" ? "There" : "Watched"),
      entry.rating ? text("span", { className: "diary-rating", "aria-label": entry.rating + " out of 5" }, starsText(entry.rating)) : null,
    ]),
    entry.note ? text("p", { className: "diary-note-text" }, entry.note) : null,
    h("button", { type: "button", className: "diary-edit", onClick: async () => { const { openDiarySheet } = await import("./DiarySheet.js"); openDiarySheet({ fixture: { id: entry.id, date: m.date }, league: { name: m.league, round: m.round }, teams: { home: m.home, away: m.away }, goals: m.goals }, { onChange: reload }); } }, "Edit"),
  ]);
}

export function DiaryScreen({ onBack }) {
  let kind = "all";
  const body = h("div", { className: "diary-body" });
  const draw = () => {
    const all = loadDiary(), shown = kind === "all" ? all : all.filter((e) => e.kind === kind);
    const s = diaryStats(all);
    body.replaceChildren();
    if (!all.length) {
      body.appendChild(h("section", { className: "card diary-empty" }, [
        text("strong", {}, "Your diary is empty"),
        text("p", {}, "Open any match that has kicked off and tap the diary button at the top to log it: whether you were there or watched it, a rating and a note."),
        h("button", { type: "button", className: "primary-button", onClick: () => navigate("/") }, "Find a match"),
      ]));
      return;
    }
    body.appendChild(h("section", { className: "diary-stats card" }, [stat(s.total, "Matches"), stat(s.attended, "In the stadium"), stat(s.average ?? "\u2013", "Average rating"), stat(s.goals, "Goals seen")]));
    body.appendChild(segmented([{ id: "all", label: "All" }, { id: "attended", label: "There" }, { id: "watched", label: "Watched" }], (id) => { kind = id; draw(); }, kind).node);
    if (!shown.length) body.appendChild(text("p", { className: "muted-copy diary-none" }, "Nothing here yet."));
    for (const g of groupByMonth(shown)) {
      body.appendChild(text("div", { className: "profile-section-label" }, g.label));
      body.appendChild(h("div", { className: "diary-list" }, g.entries.map((e) => entryCard(e, draw))));
    }
  };
  draw();
  return h("main", { className: "screen diary-screen" }, [PageHeader({ title: "Match diary", onBack }), body]);
}
