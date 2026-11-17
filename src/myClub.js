// What "your club" is doing right now, for the Home widget and the My club shortcut: a match in play, one that just
// finished, the next one, or nothing. Pure decisions live here (and are tested); fetching is at the bottom.
import { getFixturesByDate, getTeamFixtures } from "./api/footballApi.js";
import { localDateISO } from "./utils/fixtures.js";

const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
const DONE = new Set(["FT", "AET", "PEN"]);
const MINUTE = 60 * 1000, HOUR = 60 * MINUTE;
const kickoff = (fx) => Date.parse(fx?.fixture?.date);
const isMine = (fx, teamId) => fx?.teams?.home?.id === teamId || fx?.teams?.away?.id === teamId;

// today/next/last: fixture lists as the football service returns them. Returns { kind: "live"|"result"|"next"|"none", fx }.
export function clubState({ today = [], next = [], last = [] }, teamId, now = Date.now()) {
  const mine = [...today, ...next, ...last].filter((fx) => isMine(fx, teamId) && fx.fixture?.id);
  const live = mine.find((fx) => LIVE.has(fx.fixture.status?.short));
  if (live) return { kind: "live", fx: live };
  const finished = mine.filter((fx) => DONE.has(fx.fixture.status?.short)).sort((a, b) => kickoff(b) - kickoff(a));
  if (finished[0] && now - kickoff(finished[0]) < 5 * HOUR) return { kind: "result", fx: finished[0] }; // the full-time score stays up for a few hours
  const upcoming = mine.filter((fx) => ["NS", "TBD"].includes(fx.fixture.status?.short) && kickoff(fx) > now - 10 * MINUTE).sort((a, b) => kickoff(a) - kickoff(b));
  if (upcoming[0]) return { kind: "next", fx: upcoming[0] };
  if (finished[0]) return { kind: "result", fx: finished[0] };
  return { kind: "none", fx: null };
}

// Where the My club shortcut should land.
export const targetPath = (state, teamId) => (state.fx ? "/match/" + state.fx.fixture.id : "/club/" + teamId);

// "Today at 8:00 PM" / "Tomorrow at 8:00 PM" / "Sat, 15 Nov at 8:00 PM", and "in 2h 15m" when it is close.
export function kickoffLabel(ts, now = Date.now()) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return { when: "", soon: "" };
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(d) - startOfDay(new Date(now))) / 864e5);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const day = days === 0 ? "Today" : days === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const ms = ts - now, mins = Math.floor(ms / MINUTE);
  const soon = ms <= 0 ? "" : mins < 1 ? "starting now" : mins < 60 ? `in ${mins} min` : ms < 24 * HOUR ? `in ${Math.floor(mins / 60)}h${mins % 60 ? " " + (mins % 60) + "m" : ""}` : "";
  return { when: `${day} at ${time}`, soon };
}

// The season that has just ended or is running: it starts in July (the same rule the rest of the app uses).
export const seasonFor = (now = Date.now()) => { const d = new Date(now); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };
// Shown on Home from May to July, when seasons end: a nudge towards the recap.
export const recapSeason = (now = Date.now()) => (new Date(now).getMonth() >= 4 && new Date(now).getMonth() <= 6 ? seasonFor(now) : null);

export async function loadClubState(teamId) {
  const [today, next, last] = await Promise.all([
    getFixturesByDate(localDateISO(0)).catch(() => []),
    getTeamFixtures(teamId, { next: 1 }).catch(() => []),
    getTeamFixtures(teamId, { last: 1 }).catch(() => []),
  ]);
  return clubState({ today, next, last }, teamId);
}
