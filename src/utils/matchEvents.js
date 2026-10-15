// Pure helpers for the match page: goal scorers, red cards, recent form and the
// kick-off countdown. No DOM so they are easy to test.
import { isFinished } from "./fixtures.js";

const lower = (v) => String(v ?? "").toLowerCase();

// Events embedded in a single-fixture response (`fixtures?id=`), or null when
// the provider didn't include them and they must be fetched separately.
export const eventsOf = (fx) => (Array.isArray(fx?.events) ? fx.events : null);

// "Goal" events that actually put the ball in: a missed penalty is also sent
// as type "Goal" (detail "Missed Penalty") and must never count.
export const isScoredGoal = (event) => lower(event?.type) === "goal" && !/missed/.test(lower(event?.detail));
export const isMissedPenalty = (event) => lower(event?.type) === "goal" && /missed/.test(lower(event?.detail));
export const isRedCard = (event) => lower(event?.type) === "card" && /red|second yellow/.test(lower(event?.detail));

export function formatMinute(time) {
  if (time?.elapsed == null) return "";
  return time.elapsed + (time.extra ? "+" + time.extra : "") + "'";
}

// Which side each goal counts for. Providers disagree on whether an own goal is
// filed under the team of the player or the team it helped, so check both
// readings against the final score and keep the one that adds up.
export function assignGoals(events, fx) {
  const homeId = fx?.teams?.home?.id;
  const awayId = fx?.teams?.away?.id;
  const goals = (Array.isArray(events) ? events : []).filter(isScoredGoal);
  const sideOf = (event, flip) => {
    const own = /own/.test(lower(event.detail));
    const home = event.team?.id === homeId;
    const away = event.team?.id === awayId;
    if (!home && !away) return null;
    return (home !== (own && flip)) ? "home" : "away";
  };
  const count = (flip) => goals.reduce((acc, e) => { const s = sideOf(e, flip); if (s) acc[s]++; return acc; }, { home: 0, away: 0 });
  const fits = (c) => c.home === (fx?.goals?.home ?? -1) && c.away === (fx?.goals?.away ?? -1);
  const flip = fits(count(true)) || !fits(count(false));

  const sides = { home: new Map(), away: new Map() };
  for (const event of goals) {
    const side = sideOf(event, flip);
    if (!side) continue;
    const name = event.player?.name || "Unknown";
    const key = (event.player?.id ?? name) + "|" + (/own/.test(lower(event.detail)) ? "og" : "");
    const entry = sides[side].get(key) || { name, minutes: [], own: /own/.test(lower(event.detail)), penalty: false };
    entry.minutes.push(formatMinute(event.time));
    if (/penalty/.test(lower(event.detail))) entry.penalty = true;
    sides[side].set(key, entry);
  }
  return { home: [...sides.home.values()], away: [...sides.away.values()] };
}

export function redCardCounts(events, fx) {
  const counts = { home: 0, away: 0 };
  for (const event of Array.isArray(events) ? events : []) {
    if (!isRedCard(event)) continue;
    if (event.team?.id === fx?.teams?.home?.id) counts.home++;
    else if (event.team?.id === fx?.teams?.away?.id) counts.away++;
  }
  return counts;
}

// Last five finished matches before this one, oldest first: ["W","D","L",...].
export function formLetters(rows, teamId, beforeIso, resultFor, limit = 5) {
  const before = new Date(beforeIso).getTime();
  return (Array.isArray(rows) ? rows : [])
    .filter((fx) => isFinished(fx?.fixture?.status?.short) && (!Number.isFinite(before) || new Date(fx.fixture.date).getTime() < before))
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
    .map((fx) => resultFor(fx, teamId))
    .filter(Boolean)
    .slice(-limit);
}

const two = (n) => String(n).padStart(2, "0");

// 3d 04h 12m (a day or more away), else 04:12:09.
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days >= 1) return days + "d " + two(hours) + "h " + two(minutes) + "m";
  return two(hours) + ":" + two(minutes) + ":" + two(seconds);
}
