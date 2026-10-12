import { h, text } from "../utils/h.js";
import { arrangeRows, layoutSide, kitFor, hexOrNull, shortName } from "../utils/lineup.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

// ---------------------------------------------------------------------------
// Events -> per-player badges (goals, cards, substituted off / on)
// ---------------------------------------------------------------------------
// `starterIds` (ids of both starting XIs) lets us tell who left and who came on
// regardless of which side of the event the provider put them on: a starter can
// only be the one going off, a substitute only the one coming on.
export function summarizeEvents(events, starterIds = null) {
  const players = new Map();
  const cameOn = new Map();
  const get = (id) => {
    if (!players.has(id)) players.set(id, { goals: 0, own: 0, yellow: 0, red: false, off: null });
    return players.get(id);
  };

  for (const event of Array.isArray(events) ? events : []) {
    const type = String(event?.type || "").toLowerCase();
    const detail = String(event?.detail || "").toLowerCase();
    const minute = (event?.time?.elapsed ?? "") + (event?.time?.extra ? "+" + event.time.extra : "");
    const id = event?.player?.id;

    if (type === "goal" && id) {
      if (detail.includes("own goal")) get(id).own++;
      else if (!detail.includes("missed")) get(id).goals++;
    } else if (type === "card" && id) {
      if (detail.includes("red") || detail.includes("second yellow")) get(id).red = true;
      else get(id).yellow++;
    } else if (type === "subst") {
      const a = event?.player?.id, b = event?.assist?.id;
      let offId = a, onId = b; // provider convention: player = leaving, assist = arriving
      if (starterIds && a && b) {
        if (starterIds.has(b) && !starterIds.has(a)) { offId = b; onId = a; }
      }
      if (offId) get(offId).off = minute;
      if (onId) cameOn.set(onId, minute);
    }
  }
  return { players, cameOn };
}

// ---------------------------------------------------------------------------
// Pitch
// ---------------------------------------------------------------------------
function pitchLines() {
  const lines = ["half", "circle", "spot-centre", "box top", "box bottom", "six top", "six bottom", "arc top", "arc bottom", "spot top", "spot bottom"];
  return h("div", { className: "pitch-field", "aria-hidden": "true" }, lines.map((name) => h("span", { className: "pitch-line " + name })));
}

const GK_KIT = { home: { primary: "#f5a300", number: "#111114", border: "rgba(255,255,255,.85)" }, away: { primary: "#7c3aed", number: "#ffffff", border: "rgba(255,255,255,.85)" } };

function goalkeeperKit(team, side, fallbackOpponent) {
  const supplied = team?.colors?.goalkeeper;
  return supplied && hexOrNull(supplied.primary) ? kitFor({ colors: { player: supplied } }, side, fallbackOpponent) : GK_KIT[side];
}

function badge(kind, count) {
  return h("span", { className: "pitch-badge " + kind, "aria-hidden": "true" }, count > 1 ? String(count) : "");
}

function describe(player, info, cameOnAt) {
  const bits = [player.name, "number " + (player.number ?? "unknown")];
  if (info?.goals) bits.push(info.goals + (info.goals > 1 ? " goals" : " goal"));
  if (info?.yellow) bits.push("yellow card");
  if (info?.red) bits.push("red card");
  if (info?.off) bits.push("substituted off at " + info.off + "'");
  if (cameOnAt) bits.push("came on at " + cameOnAt + "'");
  return bits.join(", ");
}

function openPlayer(player) {
  if (player?.id) navigate("/player/" + buildSlug(player.id, player.name || "player"));
}

function marker({ player, x, y, span }, kit, gkKit, summary) {
  const info = summary.players.get(player.id);
  const isKeeper = player.pos === "G";
  const colors = isKeeper ? gkKit : kit;
  const shirt = h("span", { className: "pitch-shirt", style: { background: colors.primary, color: colors.number, boxShadow: "inset 0 0 0 2px " + colors.border } }, [
    text("b", {}, player.number ?? ""),
    info?.goals ? badge("goal", info.goals) : null,
    info?.red ? badge("red") : info?.yellow ? badge("yellow") : null,
    info?.off ? badge("off") : null,
  ]);

  return h("button", {
    type: "button",
    className: "pitch-player" + (span <= 18.1 ? " tight" : ""),
    style: { left: x.toFixed(2) + "%", top: y.toFixed(2) + "%", width: Math.min(26, Math.max(14, span || 20)).toFixed(2) + "%" },
    "aria-label": describe(player, info, summary.cameOn.get(player.id)),
    onClick: () => openPlayer(player),
  }, [shirt, text("span", { className: "pitch-name" }, shortName(player.name))]);
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
function pickSides(fixture, lineups) {
  const list = (Array.isArray(lineups) ? lineups : []).filter((entry) => entry && entry.team);
  const homeId = fixture?.teams?.home?.id;
  const awayId = fixture?.teams?.away?.id;
  let home = list.find((entry) => entry.team.id === homeId) || null;
  let away = list.find((entry) => entry.team.id === awayId) || null;
  if (!home && !away) {
    home = list[0] || null;
    away = list[1] || null;
  } else if (!home) home = list.find((entry) => entry !== away) || null;
  else if (!away) away = list.find((entry) => entry !== home) || null;
  return { home, away };
}

function teamHead(entry, side) {
  if (!entry) return h("div", { className: "lineup-head " + side }, [text("span", { className: "muted-copy" }, "Lineup not available")]);
  const team = entry.team;
  const inner = [
    team.logo ? h("img", { className: "lineup-head-logo", src: team.logo, alt: "" }) : null,
    h("div", { className: "lineup-head-copy" }, [text("strong", {}, team.name || "Team"), text("span", { className: "mono" }, entry.formation || "")]),
  ];
  return team.id
    ? h("button", { type: "button", className: "lineup-head " + side, onClick: () => navigate("/club/" + buildSlug(team.id, team.name || "club")) }, inner)
    : h("div", { className: "lineup-head " + side }, inner);
}

function benchCard(entry, summary) {
  const subs = (entry.substitutes || []).map((item) => item.player || item).filter(Boolean);
  const coach = entry.coach?.name;
  return h("section", { className: "card bench-card" }, [
    h("div", { className: "bench-head" }, [
      entry.team?.logo ? h("img", { className: "bench-logo", src: entry.team.logo, alt: "" }) : null,
      h("div", { className: "bench-title" }, [text("strong", {}, entry.team?.name || "Team"), coach ? text("span", { className: "muted-copy" }, "Coach: " + coach) : null]),
    ]),
    subs.length ? text("div", { className: "section-kicker bench-kicker" }, "Substitutes") : null,
    ...subs.slice(0, 15).map((player) => {
      const onAt = summary.cameOn.get(player.id);
      return h("button", { type: "button", className: "bench-row", onClick: () => openPlayer(player), "aria-label": player.name + (onAt ? ", came on at " + onAt + "'" : "") }, [
        text("span", { className: "mono bench-number" }, player.number ?? "\u2013"),
        text("span", { className: "bench-name" }, player.name || "Unknown"),
        onAt ? text("span", { className: "bench-tag" }, "On " + onAt + "'") : null,
        text("span", { className: "bench-pos" }, player.pos || ""),
      ]);
    }),
  ]);
}

// Returns a node, or null when the provider has no lineups for this match yet.
export function LineupPitch({ fixture, lineups, events }) {
  const { home, away } = pickSides(fixture, lineups);
  if (!home && !away) return null;

  const starterIds = new Set();
  for (const entry of [home, away]) {
    for (const item of entry?.startXI || []) {
      const id = (item?.player || item)?.id;
      if (id) starterIds.add(id);
    }
  }
  const summary = summarizeEvents(events, starterIds);
  const homeKit = kitFor(home?.team, "home");
  const awayKit = kitFor(away?.team, "away", homeKit.primary);

  const markers = [];
  const addSide = (entry, side, kit) => {
    if (!entry) return;
    const rows = arrangeRows(entry.startXI, entry.formation);
    const gk = goalkeeperKit(entry.team, side, kit.primary);
    layoutSide(rows, side).forEach((spot) => markers.push(marker(spot, kit, gk, summary)));
  };
  addSide(home, "home", homeKit);
  addSide(away, "away", awayKit);

  const label = (entry, side) => entry
    ? h("div", { className: "pitch-team " + side }, [text("span", {}, entry.team?.name || ""), text("span", { className: "mono pitch-formation" }, entry.formation || "")])
    : null;

  const pitch = h("div", { className: "pitch", role: "group", "aria-label": "Starting lineups on the pitch" }, [
    pitchLines(),
    label(home, "home"),
    label(away, "away"),
    ...markers,
  ]);

  return h("section", { className: "lineup-view" }, [
    h("div", { className: "lineup-heads" }, [teamHead(home, "home"), teamHead(away, "away")]),
    pitch,
    home ? benchCard(home, summary) : null,
    away ? benchCard(away, summary) : null,
  ]);
}
