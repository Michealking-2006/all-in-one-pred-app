// Rivalry: everything about two clubs meeting each other. Opened from a match page ("Full rivalry") at /h2h/<team>-<team>.
import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { navigate } from "../router.js";
import { safeMessage } from "../utils/errors.js";
import { loadRivalry, derbyName } from "../rivalry.js";
import { kickoffLabel } from "../myClub.js";

const stat = (value, label) => h("div", { className: "rc-stat" }, [text("strong", {}, String(value)), text("span", {}, label)]);
const note = (message, cls = "muted-copy") => text("p", { className: cls + " hub-note" }, message);
const fmt = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); };
const FORM = (list) => h("span", { className: "rv-form", "aria-label": "Last " + list.length + " results: " + list.join(", ") }, list.map((r) => text("span", { className: "form-chip " + r }, r)));

function crestBlock(team) {
  return h("button", { type: "button", className: "rv-team", onClick: () => navigate("/club/" + team.id) }, [team.logo ? h("img", { src: team.logo, alt: "", width: "72", height: "72" }) : h("span", { className: "rv-nologo" }), text("strong", {}, team.name)]);
}

function recordBar(s, a, b) {
  if (!s.played) return null;
  const seg = (n, cls) => (n ? h("span", { className: "rv-seg " + cls, style: { flexGrow: String(n) } }, String(n)) : null);
  return h("div", { className: "rv-bar", role: "img", "aria-label": `${a.name} ${s.aWins} wins, ${s.draws} draws, ${b.name} ${s.bWins} wins` }, [seg(s.aWins, "a"), seg(s.draws, "d"), seg(s.bWins, "b")]);
}

const biggest = (g, team, other) => (g ? h("div", { className: "rc-line" }, [text("span", {}, `Biggest ${team.name} win`), text("strong", {}, `${g.ga}\u2013${g.gb} ${g.fx.teams.home.id === team.id ? "v" : "at"} ${other.name}`), text("span", { className: "rv-when" }, fmt(g.fx.fixture.date))]) : null);

export function RivalryScreen({ a, b, onBack }) {
  const body = h("div", { className: "rivalry-body" }, [note("Loading the rivalry\u2026")]);
  const root = h("main", { className: "screen rivalry-screen" }, [PageHeader({ title: "Head to head", onBack }), body]);
  loadRivalry(a, b).then((r) => {
    body.replaceChildren();
    const { stats: s, teamA, teamB } = r, derby = derbyName(a, b);
    body.appendChild(h("section", { className: "card rv-hero" }, [
      derby ? text("strong", { className: "rv-derby" }, derby) : null,
      h("div", { className: "rv-teams" }, [crestBlock(teamA), text("span", { className: "rv-vs" }, "v"), crestBlock(teamB)]),
      recordBar(s, teamA, teamB),
      s.played ? h("div", { className: "rv-labels" }, [text("span", {}, `${teamA.name} wins`), text("span", {}, "Draws"), text("span", {}, `${teamB.name} wins`)]) : null,
    ]));
    if (r.failed) { body.appendChild(note("Couldn't load their past meetings. Check your connection and try again.", "async-error-state")); }
    else if (!s.played) body.appendChild(note("These clubs haven't met in the matches we have."));
    else {
      body.appendChild(h("section", { className: "diary-stats card" }, [stat(s.played, "Meetings"), stat(`${s.aGoals}\u2013${s.bGoals}`, "Goals"), stat(s.avgGoals, "Goals a game"), stat(s.bothScoredPct + "%", "Both scored")]));
      const wins = [biggest(s.biggestA, teamA, teamB), biggest(s.biggestB, teamB, teamA)].filter(Boolean);
      if (wins.length) body.appendChild(h("section", { className: "card rc-lines" }, wins));
    }
    if (r.formA.length || r.formB.length) body.appendChild(h("section", { className: "card rv-formcard" }, [text("div", { className: "profile-section-label" }, "Recent form"), h("div", { className: "rv-formrow" }, [text("span", {}, teamA.name), FORM(r.formA)]), h("div", { className: "rv-formrow" }, [text("span", {}, teamB.name), FORM(r.formB)])]));
    if (r.next) {
      const k = kickoffLabel(Date.parse(r.next.fixture.date));
      body.appendChild(h("button", { type: "button", className: "card rv-next", onClick: () => navigate("/match/" + r.next.fixture.id) }, [text("span", {}, "Next meeting"), text("strong", {}, `${r.next.teams.home.name} v ${r.next.teams.away.name}`), text("span", {}, [k.when, k.soon].filter(Boolean).join(", "))]));
    }
    if (s.recent.length) {
      body.appendChild(text("div", { className: "profile-section-label" }, "Recent meetings"));
      body.appendChild(h("div", { className: "diary-list" }, s.recent.map((g) => h("button", { type: "button", className: "card rv-meeting", onClick: () => navigate("/match/" + g.fx.fixture.id), "aria-label": `${g.fx.teams.home.name} ${g.fx.goals.home} ${g.fx.goals.away} ${g.fx.teams.away.name}, ${fmt(g.fx.fixture.date)}. Open match.` }, [
        text("span", { className: "rv-meeting-score" }, `${g.fx.teams.home.name} ${g.fx.goals.home}\u2013${g.fx.goals.away} ${g.fx.teams.away.name}`),
        text("span", { className: "diary-meta" }, g.fx.league?.name || ""),
        text("span", { className: "diary-meta" }, fmt(g.fx.fixture.date)),
      ]))));
    }
  }).catch((error) => body.replaceChildren(note(safeMessage(error, "Couldn't load the rivalry."), "async-error-state")));
  return root;
}
