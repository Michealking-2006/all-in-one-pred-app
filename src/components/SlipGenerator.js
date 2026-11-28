import { h, text } from "../utils/h.js";
import { kickoffTime } from "../utils/fixtures.js";
import { listPredicted } from "../predictions/engine.js";
import { BET_TYPES, RISKS, MIN_GAMES, MAX_GAMES, ODDS_RANGE, buildSlip, buildDifferent, swapPick, relaxSuggestion, summarise, returnsFor, slipTier } from "../predictions/slip.js";
import { SkeletonRow } from "./Skeleton.js";
import { showToast } from "../toast.js";
import { safeMessage } from "../utils/errors.js";

// Build a betting slip from today's (or the next few days') predicted matches.
//   isVip            the generator is a Premium feature: anyone can set it up, building the slip needs Premium
//   onRequestUpgrade opens the Premium page
const POOL_MAX = 60, DAYS_AHEAD = 3, STAKES = [5, 10, 25, 50, 100], KEY = "scoutwave.slip.v1";
// The settings are remembered on this phone (never the slip itself, which depends on today's matches).
const loadSettings = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const saveSettings = (st) => { try { localStorage.setItem(KEY, JSON.stringify({ games: st.games, risk: st.risk, todayOnly: st.todayOnly, types: [...st.types], minOdds: st.minOdds, stake: st.stake })); } catch { /* private mode: not remembered */ } };

// The predicted matches, from our own server (no football data service). "Today" means today on this phone's clock.
async function loadPool(todayOnly) {
  const items = await listPredicted(todayOnly ? 1 : DAYS_AHEAD);
  const today = new Date().toDateString();
  // A locked teaser has no pick in it, so it can't be part of a slip.
  return items.filter(({ fx, prediction }) => prediction && !prediction.locked && prediction.probs && Date.parse(fx.fixture.date) > Date.now() && (!todayOnly || new Date(fx.fixture.date).toDateString() === today)).slice(0, POOL_MAX);
}

const dayLabel = (iso) => {
  const d = new Date(iso), start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(new Date())) / 864e5);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};
const crest = (team) => (team?.logo ? h("img", { className: "pred-crest", src: team.logo, alt: "", width: 28, height: 28, loading: "lazy", decoding: "async" }) : h("span", { className: "pred-crest pred-crest-blank", "aria-hidden": "true" }));
const fmt = (n) => n.toFixed(2);

export function SlipGenerator({ isVip = false, onRequestUpgrade = () => {} } = {}) {
  const saved = loadSettings();
  const typeIds = BET_TYPES.map((t) => t.id);
  const state = {
    games: Number.isInteger(saved.games) && saved.games >= MIN_GAMES && saved.games <= MAX_GAMES ? saved.games : 3,
    risk: RISKS[saved.risk] ? saved.risk : "safe",
    todayOnly: saved.todayOnly === true,
    leagues: new Set(),
    types: new Set(Array.isArray(saved.types) && saved.types.some((t) => typeIds.includes(t)) ? saved.types.filter((t) => typeIds.includes(t)) : typeIds),
    minOdds: Number.isFinite(saved.minOdds) ? Math.min(ODDS_RANGE.max, Math.max(ODDS_RANGE.min, saved.minOdds)) : ODDS_RANGE.default,
    stake: STAKES.includes(saved.stake) ? saved.stake : 10,
  };
  let current = null; // the slip on screen: { picks, short }
  const locked = new Set(); // "matchId|type|pick" of picks kept when the slip is rebuilt
  const rejected = new Set(); // match ids swapped away, so a swap doesn't bring them back
  const pickKey = (c) => c.fixtureId + "|" + c.type + "|" + c.pick;
  const settings = () => ({ games: state.games, risk: state.risk, types: [...state.types], minOdds: state.minOdds, leagues: [...state.leagues] });
  const pools = new Map(); // todayOnly -> Promise of the predicted matches
  const poolFor = () => { const key = state.todayOnly; if (!pools.has(key)) pools.set(key, loadPool(key).catch((e) => { pools.delete(key); throw e; })); return pools.get(key); };

  // ---- controls -------------------------------------------------------------------------------------------
  const gameButtons = Array.from({ length: MAX_GAMES - MIN_GAMES + 1 }, (_, i) => MIN_GAMES + i).map((n) =>
    h("button", { type: "button", className: "slip-count", "aria-pressed": "false", "aria-label": n + " games", onClick: () => { state.games = n; paintControls(); } }, String(n)));
  const riskButtons = Object.entries(RISKS).map(([id, r]) => h("button", { type: "button", role: "radio", onClick: () => { state.risk = id; paintControls(); } }, r.label));
  const todayInput = h("input", { type: "checkbox", role: "switch", className: "slip-switch-input", "aria-label": "Today's matches only", onChange: (e) => { state.todayOnly = e.target.checked; state.leagues.clear(); paintControls(); refreshLeagues(); } });
  let leagueChips = [];
  const leagueRow = h("div", { className: "slip-chips", role: "group", "aria-label": "Leagues" }, [h("span", { className: "slip-chips-note" }, "Loading leagues")]);
  const typeButtons = BET_TYPES.map((t) => h("button", { type: "button", className: "slip-chip", "aria-pressed": "true", onClick: () => { if (state.types.has(t.id)) { if (state.types.size > 1) state.types.delete(t.id); } else state.types.add(t.id); paintControls(); } }, t.label));
  const oddsValue = h("output", { className: "slip-odds-value" }, fmt(state.minOdds));
  const slider = h("input", { type: "range", className: "slip-range", min: String(ODDS_RANGE.min), max: String(ODDS_RANGE.max), step: String(ODDS_RANGE.step), value: String(state.minOdds), "aria-label": "Minimum odds per match", onInput: (e) => { state.minOdds = Number(e.target.value); oddsValue.textContent = fmt(state.minOdds); }, onChange: () => saveSettings(state) });
  const button = h("button", { type: "button", className: "primary-button slip-generate", onClick: () => generate(false) }, [h("i", { "data-lucide": "zap", "aria-hidden": "true" }), text("span", {}, "Generate slip")]);
  const result = h("div", { className: "slip-result", "aria-live": "polite" });

  function paintControls() {
    saveSettings(state);
    gameButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(MIN_GAMES + i === state.games)));
    riskButtons.forEach((b, i) => b.className = Object.keys(RISKS)[i] === state.risk ? "active" : "");
    riskButtons.forEach((b, i) => b.setAttribute("aria-checked", String(Object.keys(RISKS)[i] === state.risk)));
    todayInput.checked = state.todayOnly;
    typeButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(state.types.has(BET_TYPES[i].id))));
    for (const chip of leagueChips) chip.setAttribute("aria-pressed", String(chip.dataset.league === "all" ? state.leagues.size === 0 : state.leagues.has(Number(chip.dataset.league))));
  }

  function refreshLeagues() {
    leagueChips = [];
    leagueRow.replaceChildren(h("span", { className: "slip-chips-note" }, "Loading leagues"));
    poolFor().then((pool) => {
      const byId = new Map();
      for (const { fx } of pool) if (fx.league?.id) byId.set(fx.league.id, fx.league.name || "League");
      const toggle = (id) => { if (state.leagues.has(id)) state.leagues.delete(id); else state.leagues.add(id); paintControls(); };
      leagueChips = [
        h("button", { type: "button", className: "slip-chip", "data-league": "all", onClick: () => { state.leagues.clear(); paintControls(); } }, "All leagues"),
        ...[...byId].map(([id, name]) => h("button", { type: "button", className: "slip-chip", "data-league": String(id), onClick: () => toggle(id) }, name)),
      ];
      leagueRow.replaceChildren(...leagueChips);
      if (!byId.size) leagueRow.replaceChildren(h("span", { className: "slip-chips-note" }, "No predicted matches yet for this period"));
      paintControls();
    }).catch(() => leagueRow.replaceChildren(h("span", { className: "slip-chips-note" }, "Leagues couldn't be loaded")));
  }

  // ---- the slip ---------------------------------------------------------------------------------------------
  const currentPool = [];
  function show(picks, short) {
    current = { picks, short };
    for (const k of [...locked]) if (!picks.some((c) => pickKey(c) === k)) locked.delete(k); // a lock only lasts while its pick is on the slip
    renderSlip();
  }

  function suggestionButton() {
    const fix = relaxSuggestion(currentPool, { ...settings(), locked: (current?.picks || []).filter((c) => locked.has(pickKey(c))) });
    if (!fix) return null;
    return h("button", { type: "button", className: "slip-fix", onClick: () => {
      if ("minOdds" in fix.patch) { state.minOdds = fix.patch.minOdds; slider.value = String(state.minOdds); oddsValue.textContent = fmt(state.minOdds); }
      if ("risk" in fix.patch) state.risk = fix.patch.risk;
      if ("types" in fix.patch) state.types = new Set(fix.patch.types);
      if ("leagues" in fix.patch) state.leagues = new Set(fix.patch.leagues);
      paintControls();
      generate(false);
    } }, [h("i", { "data-lucide": "zap", "aria-hidden": "true" }), text("span", {}, fix.label + " and build again")]);
  }

  function renderSlip() {
    const slip = summarise(current.picks);
    if (slip.picks.length < MIN_GAMES) {
      result.replaceChildren(h("div", { className: "empty-state slip-empty" }, [
        text("strong", {}, "No slip fits those settings"),
        text("p", {}, slip.picks.length
          ? "Only " + slip.picks.length + " pick matched."
          : currentPool.length ? "Nothing the model likes enough matches those settings." : "There are no predicted matches to build from yet. Try again after more matches are predicted, or turn off \"Today's matches only\"."),
        suggestionButton(),
      ]));
      return;
    }
    const tier = slipTier(slip.winChance);
    const copy = () => {
      const lines = slip.picks.map((c, i) => `${i + 1}. ${c.fx.teams?.home?.name} v ${c.fx.teams?.away?.name} (${dayLabel(c.fx.fixture.date)} ${kickoffTime(c.fx.fixture.date)}): ${c.label} @ ${fmt(c.odds)}`);
      const body = [`Scoutwave slip, ${slip.picks.length} selections`, ...lines, `Total odds ${fmt(slip.totalOdds)} (model odds), win chance ${(slip.winChance * 100).toFixed(1)}%`].join("\n");
      (navigator.clipboard?.writeText(body) || Promise.reject()).then(() => showToast("Slip copied", "success"), () => showToast("Couldn't copy the slip"));
    };
    const lockedCount = slip.picks.filter((c) => locked.has(pickKey(c))).length;
    const swapOptions = () => ({ ...settings(), skip: rejected });
    result.replaceChildren(
      h("div", { className: "slip-head" }, [
        h("div", {}, [text("h2", {}, "Your slip"), text("span", { className: "muted-count" }, slip.picks.length + " selections" + (current.short ? " (" + current.short + " short of " + state.games + ")" : "") + (lockedCount ? ", " + lockedCount + " kept" : ""))]),
        h("div", { className: "slip-tools" }, [
          h("button", { type: "button", className: "slip-tool", "aria-label": lockedCount ? "Build another slip, keeping the locked picks" : "Build another slip", onClick: () => generate(true) }, [h("i", { "data-lucide": "refresh-cw" })]),
          h("button", { type: "button", className: "slip-tool", "aria-label": "Copy slip", onClick: copy }, [h("i", { "data-lucide": "copy" })]),
        ]),
      ]),
      h("section", { className: "slip-summary" }, [
        h("div", { className: "slip-figures" }, [
          h("div", {}, [text("span", {}, "Total odds"), text("strong", { className: "mono" }, fmt(slip.totalOdds))]),
          h("div", {}, [text("span", {}, "Slip win chance"), text("strong", { className: "mono slip-win" }, (slip.winChance * 100).toFixed(1) + "%")]),
        ]),
        text("div", { className: "slip-returns" }, state.stake + " staked returns " + fmt(returnsFor(state.stake, slip.totalOdds))),
        h("div", { className: "slip-stakes", role: "group", "aria-label": "Stake" }, STAKES.map((n) =>
          h("button", { type: "button", "aria-pressed": String(n === state.stake), onClick: () => { state.stake = n; saveSettings(state); renderSlip(); } }, String(n)))),
      ]),
      h("div", { className: "slip-tier slip-tier-" + tier.id }, [h("i", { "data-lucide": tier.id === "low" ? "triangle-alert" : "circle-check" }), text("span", {}, tier.label)]),
      current.short ? suggestionButton() : null,
      h("div", { className: "slip-list" }, slip.picks.map((c, i) => {
        const on = locked.has(pickKey(c));
        return h("article", { className: "vip-card slip-pick" + (on ? " is-locked" : "") }, [
          h("div", { className: "slip-pick-top" }, [
            text("span", { className: "pred-league" }, c.fx.league?.name || ""),
            text("span", { className: "slip-when" }, dayLabel(c.fx.fixture.date) + " " + kickoffTime(c.fx.fixture.date)),
          ]),
          h("div", { className: "slip-pick-teams" }, [
            h("span", { className: "slip-team" }, [crest(c.fx.teams?.home), text("span", {}, c.fx.teams?.home?.name || "Home")]),
            h("span", { className: "slip-team" }, [crest(c.fx.teams?.away), text("span", {}, c.fx.teams?.away?.name || "Away")]),
          ]),
          h("div", { className: "slip-pick-bet" }, [
            h("div", {}, [text("strong", {}, c.label), text("span", { className: "pred-fact" }, Math.round(c.p * 100) + "% chance" + (c.xg ? ", expected goals " + c.xg : ""))]),
            text("span", { className: "slip-odds mono" }, fmt(c.odds)),
          ]),
          h("div", { className: "slip-pick-actions" }, [
            h("button", { type: "button", className: "slip-act" + (on ? " on" : ""), "aria-pressed": String(on), "aria-label": (on ? "Unlock " : "Keep ") + c.label, onClick: () => { if (on) locked.delete(pickKey(c)); else locked.add(pickKey(c)); renderSlip(); } }, [h("i", { "data-lucide": "lock", "aria-hidden": "true" }), text("span", {}, on ? "Kept" : "Keep")]),
            h("button", { type: "button", className: "slip-act", "aria-label": "Swap " + c.label + " for another match", onClick: () => {
              const swapped = swapPick(currentPool, current.picks, i, swapOptions());
              if (!swapped) { showToast("No other match fits these settings"); return; }
              rejected.add(c.fixtureId); locked.delete(pickKey(c)); show(swapped.picks, current.short);
            } }, [h("i", { "data-lucide": "refresh-cw", "aria-hidden": "true" }), text("span", {}, "Swap")]),
            slip.picks.length > MIN_GAMES ? h("button", { type: "button", className: "slip-act", "aria-label": "Remove " + c.label, onClick: () => { rejected.add(c.fixtureId); show(current.picks.filter((_, j) => j !== i), current.short + 1); } }, [h("i", { "data-lucide": "x", "aria-hidden": "true" }), text("span", {}, "Remove")]) : null,
          ]),
        ]);
      })),
      h("p", { className: "pred-footnote" }, [h("i", { "data-lucide": "info" }), text("span", {}, "Odds are Scoutwave model odds (the model's fair price with a 6% margin), not bookmaker prices, so check the real price before you bet. Win chance is the model's estimate. Estimates, not guarantees or betting advice.")]),
    );
  }

  async function generate(again) {
    if (!isVip) { onRequestUpgrade(); return; }
    button.disabled = true; button.classList.add("is-loading");
    result.replaceChildren(SkeletonRow({ lines: 2 }), SkeletonRow({ lines: 2 }));
    try {
      currentPool.splice(0, currentPool.length, ...(await poolFor()));
      if (!again) { locked.clear(); rejected.clear(); }
      const keep = (current?.picks || []).filter((c) => locked.has(pickKey(c)));
      const options = { ...settings(), locked: again ? keep : [] };
      const slip = again ? buildDifferent(currentPool, options, current?.picks || []) : buildSlip(currentPool, options);
      show(slip.picks, slip.short);
    } catch (error) {
      result.replaceChildren(h("div", { className: "error-state", role: "alert" }, [text("p", {}, safeMessage(error, "Matches couldn't be loaded. Try again shortly."))]));
    } finally { button.disabled = false; button.classList.remove("is-loading"); }
  }

  const group = (title, body) => h("div", { className: "slip-group" }, [text("h3", { className: "slip-label" }, title), body]);
  paintControls();
  refreshLeagues();
  return h("div", { className: "slip-generator" }, [
    isVip ? null : h("section", { className: "card slip-gate" }, [h("i", { "data-lucide": "lock" }), h("div", {}, [text("strong", {}, "Slip Generator is for Premium members"), text("p", {}, "Set it up as you like. Building the slip needs Premium."), h("button", { type: "button", className: "slip-gate-link", onClick: onRequestUpgrade }, "See Premium")])]),
    h("section", { className: "card slip-form" }, [
      group("Number of games", h("div", { className: "slip-counts" }, gameButtons)),
      group("Risk level", h("div", { className: "seg slip-risk", role: "radiogroup", "aria-label": "Risk level" }, riskButtons)),
      h("label", { className: "slip-today" }, [h("span", { className: "slip-today-copy" }, [text("strong", {}, "Today's matches only"), text("small", {}, "Otherwise the next " + DAYS_AHEAD + " days are used")]), todayInput]),
      group("Leagues", leagueRow),
      group("Bet types", h("div", { className: "slip-chips" }, typeButtons)),
      group("Minimum odds per match", h("div", { className: "slip-odds-row" }, [text("span", { className: "slip-bound" }, fmt(ODDS_RANGE.min)), oddsValue, text("span", { className: "slip-bound" }, fmt(ODDS_RANGE.max))])),
      slider,
      button,
    ]),
    result,
  ]);
}
