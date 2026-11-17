// Transfers & injuries for the clubs a person follows. The decisions (who counts as a recent signing, who is still
// injured, which news is about this club and topic) are plain functions and are tested; the loaders at the bottom ask
// the football service and the news feed.
import { getTeamById } from "./api/footballApi.js";
import { getTeamTransfers, getTeamInjuries } from "./api/footballExtras.js";
import { getNews } from "./api/newsApi.js";
import { tagById } from "./newsTags.js";
import { seasonFor } from "./myClub.js";
import { clubById } from "./clubs.js";

const DAY = 864e5;
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Moves in the last `months` months involving the club, newest first, one line per player (their latest move with this
// club). rows: the football service's `transfers?team=` answer.
export function recentTransfers(rows, teamId, now = Date.now(), months = 12) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const moves = (row.transfers || []).filter((t) => t?.date && (t.teams?.in?.id === teamId || t.teams?.out?.id === teamId)).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    const t = moves[0], when = t ? Date.parse(t.date) : NaN;
    if (!t || !Number.isFinite(when) || when > now + 30 * DAY || now - when > months * 30.4 * DAY) continue;
    const joined = t.teams.in?.id === teamId;
    const fee = String(t.type || "").trim();
    out.push({ playerId: row.player?.id, name: String(row.player?.name || "Player"), date: t.date, direction: joined ? "in" : "out", other: joined ? t.teams.out || {} : t.teams.in || {}, fee: !fee || /^n\/?a$/i.test(fee) ? "Undisclosed" : fee });
  }
  return out.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 40);
}

// Players who are out or doubtful: each player once (their latest entry), only entries for matches from the last two
// weeks onwards, those definitely out first. rows: `injuries?team=&season=`.
export function currentInjuries(rows, now = Date.now()) {
  const byPlayer = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const id = r.player?.id, when = Date.parse(r.fixture?.date);
    if (!id || !Number.isFinite(when) || when < now - 14 * DAY) continue;
    const have = byPlayer.get(id);
    if (!have || when > have.when) byPlayer.set(id, { playerId: id, name: String(r.player.name || "Player"), photo: r.player.photo || "", reason: String(r.player.reason || "Injury"), out: !/question/i.test(r.player.type || ""), when });
  }
  return [...byPlayer.values()].sort((a, b) => Number(b.out) - Number(a.out) || b.when - a.when || a.name.localeCompare(b.name)).slice(0, 40);
}

// The articles that are about this club and this topic ("transfers" | "injuries"). `club` is { id, name }.
export function newsAbout(articles, club, topic) {
  const t = tagById(topic), c = tagById(club?.id);
  const aboutClub = c?.match || (club?.name ? new RegExp(escapeRe(club.name), "i") : null);
  return (Array.isArray(articles) ? articles : []).filter((a) => {
    const words = `${a?.title || ""} ${a?.description || ""}`;
    return (!t || t.match.test(words)) && (!aboutClub || aboutClub.test(words));
  });
}

// The clubs to choose from: the one you support first, then the ones you've starred (names looked up, cached for days).
export async function hubClubs(state) {
  const own = clubById(state.clubTheme?.id);
  const list = own ? [{ id: own.teamId, name: own.name, logo: own.logo, tag: own.id }] : [];
  const starred = (state.favorites?.club || []).filter((id) => id !== own?.teamId).slice(0, 6);
  const found = await Promise.all(starred.map((id) => getTeamById(id).then((rows) => rows?.[0]?.team).catch(() => null)));
  for (const team of found) if (team?.id) list.push({ id: team.id, name: team.name, logo: team.logo, tag: "" });
  return list;
}

export async function loadTransfers(club) {
  const [rows, news] = await Promise.all([getTeamTransfers(club.id).catch(() => null), loadNews(club, "transfers")]);
  return { moves: recentTransfers(rows || [], club.id), news, failed: rows === null };
}
export async function loadInjuries(club) {
  const [rows, news] = await Promise.all([getTeamInjuries(club.id, seasonFor()).catch(() => null), loadNews(club, "injuries")]);
  return { out: currentInjuries(rows || []), news, failed: rows === null };
}
async function loadNews(club, topic) {
  const source = club.tag && tagById(club.tag) ? club.tag : topic; // a themed club has its own news feed; otherwise the topic's
  const data = await getNews(1, source).catch(() => null);
  return newsAbout(data?.articles, club, topic).slice(0, 5);
}
