// Players a person follows (the star on a player's page): which club each plays for, so goals, assists and cards for
// them can be spotted in matches, in the app and (the same list is sent to the push service) when it is closed.
// Stored on the device; loaded by the player page, the live watcher and the push settings only.
const KEY = "scoutwave.players";
const MAX = 50;

export function loadFollowed() {
  try { const m = JSON.parse(localStorage.getItem(KEY) || "{}"); return m && typeof m === "object" && !Array.isArray(m) ? m : {}; } catch { return {}; }
}
const save = (m) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* storage full or blocked: following still works for this visit */ } window.dispatchEvent?.(new Event("scoutwave:players")); };

// entry: a player profile as the player page has it ({ player, statistics }). Called when starring and on every visit
// to a followed player's page, so a transfer updates the club.
export function rememberPlayer(entry) {
  const id = Number(entry?.player?.id), team = entry?.statistics?.[0]?.team;
  if (!Number.isInteger(id) || id <= 0) return;
  const m = loadFollowed();
  const next = { name: String(entry.player.name || "").slice(0, 60), photo: /^https:\/\//.test(entry.player.photo || "") ? entry.player.photo : "", teamId: Number(team?.id) || 0, teamName: String(team?.name || "").slice(0, 60) };
  if (JSON.stringify(m[id]) === JSON.stringify(next)) return; // nothing new: no write, no push update
  m[id] = next;
  const ids = Object.keys(m);
  for (const old of ids.slice(0, Math.max(0, ids.length - MAX))) delete m[old];
  save(m);
}
export function forgetPlayer(id) { const m = loadFollowed(); delete m[Number(id)]; save(m); }

// { playerId: teamId } for the players currently starred whose club is known.
export function playerTeams(starredIds, followed = loadFollowed()) {
  const out = {};
  for (const id of starredIds || []) { const t = followed[id]?.teamId; if (t) out[id] = t; }
  return out;
}

const minuteOf = (ev) => (ev.time?.elapsed ?? "") + (ev.time?.extra ? "+" + ev.time.extra : "");
export const eventKey = (ev) => [minuteOf(ev), ev.type, ev.detail, ev.player?.id || 0, ev.assist?.id || 0].join("|");

// What happened to followed players in a match's events: [{ key, kind, playerId, name, minute }]. kind: goal | penalty |
// owngoal | assist | yellow | red. A missed penalty and substitutions are not alerts.
export function followedAlerts(events, followedIds) {
  const set = new Set((followedIds || []).map(Number));
  const out = [];
  for (const ev of Array.isArray(events) ? events : []) {
    const type = String(ev.type || "").toLowerCase(), detail = String(ev.detail || "").toLowerCase();
    const push = (who, kind) => out.push({ key: eventKey(ev) + "|" + kind, kind, playerId: Number(who.id), name: who.name || "Player", minute: minuteOf(ev) + "'" });
    if (type === "goal") {
      if (detail.includes("missed")) continue;
      if (set.has(Number(ev.player?.id))) push(ev.player, detail.includes("own") ? "owngoal" : detail.includes("pen") ? "penalty" : "goal");
      if (!detail.includes("own") && set.has(Number(ev.assist?.id))) push(ev.assist, "assist");
    } else if (type === "card" && set.has(Number(ev.player?.id))) {
      push(ev.player, detail.includes("red") || detail.includes("second") ? "red" : "yellow");
    }
  }
  return out;
}

const WORDS = { goal: "scored", penalty: "scored a penalty", owngoal: "scored an own goal", assist: "set up a goal", yellow: "was booked", red: "was sent off" };
export const alertText = (a) => `${a.name} ${WORDS[a.kind]} (${a.minute})`;
