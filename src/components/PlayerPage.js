import { h, text } from "../utils/h.js";
import { createTabbedPage, emptyNode } from "../utils/tabbedPage.js";
import { getPlayerProfile, getPlayerById, getPlayerSeasons, getPlayerTransfers, getPlayerTrophies } from "../api/footballApi.js";
import { SkeletonImage } from "./Skeleton.js";
import { metaLine, entityRow, entityList, pills, seasonPicker, seasonSlot, favoriteStarButton } from "../utils/ui.js";
import { sectionShell, statTiles, kvCard } from "../utils/sections.js";
import { formatDate } from "../utils/fixtures.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

export function PlayerPage({ id, onBack, isFavorite, onToggleFavorite }) {
  // `state.profile` is what the Overview / Stats tabs render; the season bar swaps it.
  const state = { profile: getPlayerProfile(id) };
  const seasonBar = seasonSlot();
  const page = createTabbedPage({
    title: "Player",
    onBack,
    action: favoriteStarButton({ isFavorite, onToggle: onToggleFavorite }),
    hero: seasonBar.node,
    tabs: [
      { id: "overview", label: "Overview", skeleton: "playerOverview", load: () => state.profile.then(renderOverview) },
      { id: "stats", label: "Stats", skeleton: "stats", load: () => state.profile.then(renderStatistics) },
      { id: "career", label: "Career", skeleton: "list", load: () => loadCareer(id) },
      { id: "trophies", label: "Trophies", skeleton: "list", load: () => loadTrophies(id) },
    ],
  });

  // Season switcher for the season-dependent tabs (also the way out when the
  // data plan doesn't cover the newest season).
  Promise.all([getPlayerSeasons(id), state.profile.catch(() => null)])
    .then(([years, entry]) => {
      const list = [...new Set((Array.isArray(years) ? years : []).map(Number).filter(Number.isInteger))].sort((a, b) => b - a);
      if (list.length < 2) return seasonBar.hide();
      const shown = Number(entry?.statistics?.[0]?.league?.season);
      seasonBar.show(seasonPicker({
        options: list.map((year) => ({ value: year, label: String(year) })),
        value: list.includes(shown) ? shown : list[0],
        onChange: (value) => {
          state.profile = getPlayerById(id, Number(value)).then((rows) => rows[0] || null);
          page.reload();
        },
      }));
    })
    .catch(() => seasonBar.hide());
  return page;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (list, pick) => list.reduce((total, s) => total + num(pick(s)), 0);
const nz = (v) => (v == null || v === "" ? null : v);

function clubPath(team) { return "/club/" + buildSlug(team.id, team.name); }

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
function seasonSummary(statistics) {
  const appearances = sum(statistics, (s) => s.games?.appearences);
  const minutes = sum(statistics, (s) => s.games?.minutes);
  const goals = sum(statistics, (s) => s.goals?.total);
  const assists = sum(statistics, (s) => s.goals?.assists);
  // Average rating weighted by appearances, ignoring competitions without one.
  const rated = statistics.filter((s) => Number(s.games?.rating) > 0 && num(s.games?.appearences) > 0);
  const weight = sum(rated, (s) => s.games.appearences);
  const rating = weight ? rated.reduce((total, s) => total + Number(s.games.rating) * num(s.games.appearences), 0) / weight : null;
  return statTiles([
    ["Appearances", appearances || null], ["Goals", goals], ["Assists", assists],
    ["Minutes", minutes ? minutes.toLocaleString() : null], ["Rating", rating ? rating.toFixed(2) : null],
  ]);
}

function renderOverview(entry) {
  if (!entry) return emptyNode("Player not found.");
  const { player } = entry;
  const statistics = entry.statistics || [];
  const current = statistics[0];
  const root = h("div", { className: "entity-page-inner" });

  root.appendChild(h("section", { className: "entity-hero player-hero" }, [
    SkeletonImage({ src: player.photo, size: 104, radius: "50%" }),
    text("h1", { className: "entity-title" }, player.name),
    metaLine([player.nationality, player.age ? "Age " + player.age : null, current?.games?.position], "meta-line entity-meta"),
    player.injured ? text("span", { className: "badge badge-live" }, "Currently injured") : null,
  ]));

  if (current?.team?.name) {
    const { root: section, body } = sectionShell("Current club");
    body.appendChild(entityList([entityRow({
      image: current.team.logo, title: current.team.name, subtitle: current.league?.name,
      onClick: current.team.id ? () => navigate(clubPath(current.team)) : undefined,
    })]));
    root.appendChild(section);
  }

  const summary = statistics.length ? seasonSummary(statistics) : null;
  if (summary) {
    const { root: section, body } = sectionShell("Season summary");
    body.appendChild(summary);
    root.appendChild(section);
  }

  const shirt = statistics.map((s) => s.games?.number).find((n) => n != null);
  const born = [player.birth?.place, player.birth?.country].filter(Boolean).join(", ");
  const profile = kvCard([
    ["Full name", [player.firstname, player.lastname].filter(Boolean).join(" ") || null],
    ["Position", current?.games?.position], ["Shirt number", nz(shirt)],
    ["Age", nz(player.age)], ["Date of birth", player.birth?.date ? formatDate(player.birth.date) : null], ["Born in", born || null],
    ["Nationality", player.nationality], ["Height", player.height], ["Weight", player.weight],
  ]);
  if (profile) {
    const { root: section, body } = sectionShell("Profile");
    body.appendChild(profile);
    root.appendChild(section);
  }

  const comps = statistics.filter((s) => s.league?.name);
  if (comps.length > 1) {
    const { root: section, body } = sectionShell("Competitions");
    body.appendChild(entityList(comps.map((s) => entityRow({
      image: s.league.logo, title: s.league.name,
      subtitle: [s.team?.name, num(s.games?.appearences) + " apps", num(s.goals?.total) + " goals"].filter(Boolean).join(", "),
    }))));
    root.appendChild(section);
  }
  return root;
}

// ---------------------------------------------------------------------------
// Statistics (one competition at a time)
// ---------------------------------------------------------------------------
function statSections(s) {
  const g = s.games || {}, goals = s.goals || {}, shots = s.shots || {}, passes = s.passes || {};
  const tackles = s.tackles || {}, duels = s.duels || {}, dribbles = s.dribbles || {}, fouls = s.fouls || {};
  const cards = s.cards || {}, penalty = s.penalty || {}, subs = s.substitutes || {};
  const keeper = /goalkeeper/i.test(g.position || "");

  const groups = [
    ["Games", [
      ["Appearances", g.appearences], ["Starts", g.lineups], ["Minutes played", g.minutes ? Number(g.minutes).toLocaleString() : g.minutes],
      ["Rating", g.rating ? Number(g.rating).toFixed(2) : null], ["Substitute appearances", subs.in], ["Times substituted off", subs.out], ["On the bench", subs.bench],
      ["Captain", g.captain ? "Yes" : null],
    ]],
    [keeper ? "Goalkeeping" : "Attacking", keeper
      ? [["Saves", goals.saves], ["Goals conceded", goals.conceded], ["Penalties saved", penalty.saved], ["Goals", goals.total], ["Assists", goals.assists]]
      : [["Goals", goals.total], ["Assists", goals.assists], ["Shots", shots.total], ["Shots on target", shots.on],
         ["Dribbles attempted", dribbles.attempts], ["Dribbles won", dribbles.success], ["Penalties scored", penalty.scored], ["Penalties missed", penalty.missed]]],
    ["Passing", [["Passes", passes.total], ["Key passes", passes.key]]],
    ["Defending", [["Tackles", tackles.total], ["Interceptions", tackles.interceptions], ["Blocks", tackles.blocks], ["Duels", duels.total], ["Duels won", duels.won], ["Dribbled past", dribbles.past]]],
    ["Discipline", [["Yellow cards", cards.yellow], ["Second yellows", cards.yellowred], ["Red cards", cards.red], ["Fouls committed", fouls.committed], ["Fouls drawn", fouls.drawn]]],
  ];

  const root = h("div", { className: "entity-page-inner" });
  groups.forEach(([title, pairs]) => {
    const card = kvCard(pairs.map(([label, value]) => [label, value == null ? null : String(value)]));
    if (!card) return;
    const { root: section, body } = sectionShell(title);
    body.appendChild(card);
    root.appendChild(section);
  });
  return root;
}

function renderStatistics(entry) {
  const statistics = entry?.statistics || [];
  if (!statistics.length) return emptyNode("No statistics available for this season.");

  const wrap = h("div", { className: "entity-page-inner" });
  const detail = h("div", {});
  const label = (s, index) => {
    const dup = statistics.filter((x) => x.league?.name === s.league?.name).length > 1;
    return (s.league?.name || "Competition") + (dup && s.team?.name ? " (" + s.team.name + ")" : "");
  };
  const show = (index) => detail.replaceChildren(statSections(statistics[Number(index)]));

  if (statistics.length > 1) {
    const control = pills(statistics.map((s, i) => ({ id: String(i), label: label(s, i) })), show, "0");
    wrap.appendChild(control.node);
  } else {
    wrap.appendChild(h("div", { className: "muted-copy stats-caption" }, label(statistics[0], 0)));
  }
  wrap.appendChild(detail);
  show(0);
  return wrap;
}

// ---------------------------------------------------------------------------
// Career (transfers)
// ---------------------------------------------------------------------------
function teamCell(team) {
  return h("span", { className: "career-team" }, [
    team?.logo ? h("img", { src: team.logo, alt: "", loading: "lazy" }) : h("span", { className: "career-team-blank" }),
    text("span", {}, team?.name || "Unknown"),
  ]);
}

function loadCareer(id) {
  return getPlayerTransfers(id).then((rows) => {
    const moves = (rows || []).flatMap((entry) => entry.transfers || []).filter((m) => m?.teams);
    if (!moves.length) return emptyNode("No transfer history is available for this player.");
    moves.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    return h("div", { className: "career-list" }, moves.map((move) =>
      h("div", { className: "card career-item" }, [
        h("div", { className: "career-head" }, [
          text("span", { className: "career-date" }, move.date ? formatDate(move.date) : "Date unknown"),
          move.type ? text("span", { className: "chip" }, move.type) : null,
        ]),
        h("div", { className: "career-move" }, [teamCell(move.teams.out), h("i", { "data-lucide": "arrow-right", "aria-hidden": "true" }), teamCell(move.teams.in)]),
      ])
    ));
  });
}

// ---------------------------------------------------------------------------
// Trophies
// ---------------------------------------------------------------------------
const isWinner = (t) => /^(winner|1st)/i.test(String(t.place || ""));
const isRunnerUp = (t) => /^(2nd|runner)/i.test(String(t.place || ""));

function loadTrophies(id) {
  return getPlayerTrophies(id).then((rows) => {
    const trophies = (rows || []).filter((t) => t?.league);
    if (!trophies.length) return emptyNode("No trophies are recorded for this player.");

    const winners = trophies.filter(isWinner);
    const runnersUp = trophies.filter(isRunnerUp);
    const root = h("div", { className: "entity-page-inner" }, [statTiles([["Titles", winners.length], ["Runner-up", runnersUp.length]])]);

    const byLeague = new Map();
    for (const t of winners) {
      const key = t.league + "|" + (t.country || "");
      if (!byLeague.has(key)) byLeague.set(key, { league: t.league, country: t.country, seasons: [] });
      byLeague.get(key).seasons.push(t.season);
    }
    const won = [...byLeague.values()].sort((a, b) => b.seasons.length - a.seasons.length);
    if (won.length) {
      const { root: section, body } = sectionShell("Won");
      body.append(...won.map((item) => h("div", { className: "card trophy-card" }, [
        h("div", { className: "trophy-head" }, [
          h("div", { className: "trophy-icon" }, [h("i", { "data-lucide": "trophy" })]),
          h("div", { className: "trophy-title" }, [text("strong", {}, item.league), text("span", { className: "muted-copy" }, item.country || "")]),
          text("span", { className: "mono trophy-count" }, "\u00d7" + item.seasons.length),
        ]),
        h("div", { className: "chip-row" }, item.seasons.sort().reverse().map((season) => text("span", { className: "chip" }, season))),
      ])));
      root.appendChild(section);
    }

    if (runnersUp.length) {
      const { root: section, body } = sectionShell("Runner-up");
      body.appendChild(kvCard(runnersUp.slice(0, 15).map((t) => [t.league, t.season])));
      root.appendChild(section);
    }
    return root;
  });
}
