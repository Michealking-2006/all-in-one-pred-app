// The "Your club" card at the top of Home: live score, full-time result or the next kick-off with a countdown, for the
// club the person supports. Tap it to open the match. It redraws itself every 30 seconds and goes quiet when the person
// leaves Home. Loaded after Home is on screen, and only for people who picked a club.
import { h, text } from "../utils/h.js";
import { store } from "../store.js";
import { clubById } from "../clubs.js";
import { navigate } from "../router.js";
import { pollMs } from "../perf.js";
import { loadClubState, kickoffLabel, recapSeason } from "../myClub.js";

const crest = (team) => (team?.logo ? h("img", { className: "cw-crest", src: team.logo, alt: "", width: "44", height: "44", decoding: "async" }) : h("span", { className: "cw-crest" }));
const minute = (fx) => { const st = fx.fixture?.status || {}; return st.short === "HT" ? "Half time" : st.elapsed ? st.elapsed + (st.extra ? "+" + st.extra : "") + "'" : "Live"; };

export function drawWidget(state, club, now = Date.now()) {
  const { kind, fx } = state;
  if (!fx) return null;
  const home = fx.teams?.home, away = fx.teams?.away, score = `${fx.goals?.home ?? 0}\u2013${fx.goals?.away ?? 0}`;
  const k = kickoffLabel(Date.parse(fx.fixture?.date), now);
  const label = kind === "live" ? "Live now" : kind === "result" ? "Full time" : "Next match";
  const centre = kind === "next" ? text("span", { className: "cw-vs" }, "v") : text("strong", { className: "cw-score" }, score);
  const foot = kind === "live" ? minute(fx) : kind === "next" ? [k.when, k.soon].filter(Boolean).join(", ") : fx.league?.name || "";
  return h("button", { type: "button", className: "club-widget card " + kind, style: { "--cw-a": club.primary, "--cw-b": club.secondary }, "aria-label": `${label}: ${home?.name} ${kind === "next" ? "v" : score} ${away?.name}. ${foot}. Open match.`, onClick: () => navigate("/match/" + fx.fixture.id) }, [
    h("span", { className: "cw-head" }, [kind === "live" ? h("span", { className: "cw-dot", "aria-hidden": "true" }) : null, text("span", {}, label)]),
    h("span", { className: "cw-row" }, [
      h("span", { className: "cw-team" }, [crest(home), text("span", { className: "cw-name" }, home?.name || "Home")]),
      centre,
      h("span", { className: "cw-team" }, [crest(away), text("span", { className: "cw-name" }, away?.name || "Away")]),
    ]),
    foot ? text("span", { className: "cw-foot" }, foot) : null,
  ]);
}

export function mountClubWidget(slot) {
  const club = clubById(store.getState().clubTheme?.id);
  if (!club) return;
  slot.appendChild(h("div", { className: "club-widget card skeleton-card", "aria-hidden": "true" }));
  let state = null, fetchedAt = 0, busy = false;

  const paint = () => {
    const card = state ? drawWidget(state, club) : null;
    const season = recapSeason();
    slot.replaceChildren(...[card, season ? h("button", { type: "button", className: "cw-recap", onClick: () => navigate("/recap") }, `Your ${season}/${String(season + 1).slice(2)} season recap`) : null].filter(Boolean));
  };
  const refresh = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try { state = await loadClubState(club.teamId); fetchedAt = Date.now(); } catch { /* keep the last card */ } finally { busy = false; }
    if (slot.isConnected) paint();
  };
  const due = () => !fetchedAt || state?.kind === "live" || (state?.kind === "next" && Date.parse(state.fx.fixture.date) - Date.now() < 15 * 60000) || Date.now() - fetchedAt > 5 * 60000;

  refresh();
  const timer = window.setInterval(() => {
    if (!slot.isConnected) { window.clearInterval(timer); return; }
    if (due()) refresh(); else if (state?.kind === "next") paint(); // keeps the countdown honest
  }, pollMs(30_000));
}
