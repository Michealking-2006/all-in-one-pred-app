import { h, text } from "../utils/h.js";
import { arrangeRows, layoutSide, kitFor, hexOrNull, shortName } from "../utils/lineup.js";
import { buildSlug } from "../utils/slug.js";
import { formatRating, ratingTier } from "../utils/ratings.js";
import { navigate } from "../router.js";
import { showPhotos } from "../perf.js";

// ---------------------------------------------------------------------------
// Events -> per-player badges (goals, cards, substituted off / on)
// ---------------------------------------------------------------------------
// `starterIds` (ids of both starting XIs) lets us tell who left and who came on
// regardless of which side of the event the provider put them on: a starter can
// only be the one going off, a substitute only the one coming on.
export function summarizeEvents(events, starterIds = null) {
  const players = new Map();
  const cameOn = new Map();
  const cameOnFor = new Map(); // arriving player id -> who they replaced
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
      let offP = event?.player, onP = event?.assist; // provider convention: player = leaving, assist = arriving
      let offId = a, onId = b;
      if (starterIds && a && b) {
        if (starterIds.has(b) && !starterIds.has(a)) { offId = b; onId = a; offP = event?.assist; onP = event?.player; }
      }
      if (offId) {
        const info = get(offId);
        info.off = minute;
        info.offFor = onP?.name ? { id: onP.id ?? null, name: onP.name, minute } : null;
      }
      if (onId) {
        cameOn.set(onId, minute);
        cameOnFor.set(onId, offP?.name ? { id: offP.id ?? null, name: offP.name, minute } : null);
      }
    }
  }
  return { players, cameOn, cameOnFor };
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

export function ratingPill(entry, extraClass = "") {
  if (!entry) return null;
  return h("span", { className: "rating-pill tier-" + ratingTier(entry.rating) + (extraClass ? " " + extraClass : ""), "aria-hidden": "true" }, formatRating(entry.rating));
}

function describe(player, info, cameOnAt, rated) {
  const bits = [player.name, "number " + (player.number ?? "unknown")];
  if (info?.goals) bits.push(info.goals + (info.goals > 1 ? " goals" : " goal"));
  if (info?.yellow) bits.push("yellow card");
  if (info?.red) bits.push("red card");
  if (info?.off) bits.push("substituted off at " + info.off + "'" + (info.offFor?.name ? " for " + info.offFor.name : ""));
  if (cameOnAt) bits.push("came on at " + cameOnAt + "'");
  if (rated) bits.push("rated " + formatRating(rated.rating));
  return bits.join(", ");
}

function openPlayer(player) {
  if (player?.id) navigate("/player/" + buildSlug(player.id, player.name || "player"));
}

// The red "off" arrow. It sits inside the player's button, so it is a span with
// a button role: tapping it explains the substitution instead of opening the player.
function subBadge(info, spot, showSub) {
  const label = "Substituted off at " + info.off + "'" + (info.offFor?.name ? ", replaced by " + info.offFor.name : "");
  const open = (event) => { event.stopPropagation(); event.preventDefault(); showSub(info, spot, event.currentTarget); };
  const node = h("span", { className: "pitch-badge off tappable", role: "button", tabindex: "0", "aria-label": label, onClick: open });
  node.addEventListener("keydown", (event) => { if (event.key === " ") open(event); }); // Enter keeps opening the player
  return node;
}

// The player's face on the pitch. The lineup feed has no picture, but the provider serves every player's photo at
// a fixed address by id; a rated player's own photo is used when we have it. Until it loads (or when it can't:
// no photo, slow phone, offline) the numbered shirt shows exactly as before, so a player is never blank.
export const playerPhoto = (id) => (Number.isInteger(id) && id > 0 ? "https://media.api-sports.io/football/players/" + id + ".png" : "");

function marker({ player, x, y, span }, kit, gkKit, summary, ratings, showSub) {
  const info = summary.players.get(player.id);
  const rated = ratings?.get(player.id) || null;
  const isKeeper = player.pos === "G";
  const colors = isKeeper ? gkKit : kit;
  const src = rated?.photo || playerPhoto(player.id);
  const shirt = h("span", { className: "pitch-shirt", style: { background: colors.primary, color: colors.number, boxShadow: "inset 0 0 0 2px " + colors.border } }, [
    text("b", {}, player.number ?? ""),
    src && showPhotos() ? (() => {
      const img = h("img", { className: "pitch-photo", src, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
      img.addEventListener("load", () => { if (img.naturalWidth > 1) shirt.classList.add("photo-ok"); else img.remove(); });
      img.addEventListener("error", () => img.remove());
      return img;
    })() : null,
    text("i", { className: "pitch-num", style: { background: colors.primary, color: colors.number } }, player.number ?? ""),
    info?.goals ? badge("goal", info.goals) : null,
    info?.red ? badge("red") : info?.yellow ? badge("yellow") : null,
    info?.off ? subBadge(info, { x, y }, showSub) : null,
    ratingPill(rated, "on-pitch"),
  ]);

  return h("button", {
    type: "button",
    className: "pitch-player" + (span <= 18.1 ? " tight" : ""),
    style: { left: x.toFixed(2) + "%", top: y.toFixed(2) + "%", width: Math.min(26, Math.max(14, span || 20)).toFixed(2) + "%" },
    "aria-label": describe(player, info, summary.cameOn.get(player.id), rated),
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

function benchCard(entry, summary, ratings) {
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
      return h("button", { type: "button", className: "bench-row", onClick: () => openPlayer(player), "aria-label": player.name + (onAt ? ", came on at " + onAt + "'" : "") + (ratings?.get(player.id) ? ", rated " + formatRating(ratings.get(player.id).rating) : "") }, [
        text("span", { className: "mono bench-number" }, player.number ?? "\u2013"),
        text("span", { className: "bench-name" }, player.name || "Unknown"),
        h("span", { className: "bench-meta" }, [
          onAt ? text("span", { className: "bench-tag" }, "On " + onAt + "'") : null,
          ratingPill(ratings?.get(player.id)),
        ]),
        text("span", { className: "bench-pos" }, player.pos || ""),
      ]);
    }),
  ]);
}

// Returns a node, or null when the provider has no lineups for this match yet.
export function LineupPitch({ fixture, lineups, events, ratings = null }) {
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

  // One shared tiny popup: "63' replaced by Name". Tap the arrow again, tap
  // elsewhere, or wait a few seconds to dismiss it.
  const pop = h("div", { className: "sub-pop", hidden: true, role: "status" });
  let popOwner = null, popTimer = null;
  const hidePop = () => { pop.hidden = true; popOwner = null; clearTimeout(popTimer); };
  const showSub = (info, spot, owner) => {
    if (popOwner === owner && !pop.hidden) { hidePop(); return; }
    popOwner = owner;
    const replacement = info.offFor;
    const body = [
      text("span", { className: "sub-pop-minute mono" }, info.off + "'"),
      replacement?.name ? text("span", {}, "Replaced by") : text("span", {}, "Substituted off"),
    ];
    if (replacement?.name) body.push(text("strong", {}, replacement.name));
    pop.replaceChildren(...body);
    pop.className = "sub-pop" + (spot.y < 24 ? " below" : "") + (replacement?.id ? " linked" : "");
    pop.style.top = spot.y.toFixed(2) + "%";
    pop.onclick = replacement?.id ? () => openPlayer({ id: replacement.id, name: replacement.name }) : null;
    pop.hidden = false;
    // Centre on the arrow, but keep the whole popup inside the pitch (it is
    // clipped at the edge); the little pointer keeps aiming at the arrow.
    const width = pitch.clientWidth, popWidth = pop.offsetWidth;
    const anchor = (spot.x / 100) * width;
    const centre = Math.max(popWidth / 2 + 6, Math.min(width - popWidth / 2 - 6, anchor));
    pop.style.left = centre.toFixed(1) + "px";
    pop.style.setProperty("--pointer", (anchor - centre).toFixed(1) + "px");
    clearTimeout(popTimer);
    popTimer = setTimeout(hidePop, 5000);
  };

  const markers = [];
  const addSide = (entry, side, kit) => {
    if (!entry) return;
    const rows = arrangeRows(entry.startXI, entry.formation);
    const gk = goalkeeperKit(entry.team, side, kit.primary);
    layoutSide(rows, side).forEach((spot) => markers.push(marker(spot, kit, gk, summary, ratings, showSub)));
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
    pop,
  ]);
  // Tapping the bare pitch (or anything that isn't the arrow / popup) closes it.
  pitch.addEventListener("click", (event) => { if (!event.target.closest(".pitch-badge.off, .sub-pop")) hidePop(); });

  return h("section", { className: "lineup-view" }, [
    h("div", { className: "lineup-heads" }, [teamHead(home, "home"), teamHead(away, "away")]),
    pitch,
    home ? benchCard(home, summary, ratings) : null,
    away ? benchCard(away, summary, ratings) : null,
  ]);
}
