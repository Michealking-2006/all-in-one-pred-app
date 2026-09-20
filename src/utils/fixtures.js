// Shared fixture helpers: status codes, local-date handling, season logic,
// grouping. Kept dependency-free so any screen can import it.

export const LIVE_CODES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
export const FINISHED_CODES = new Set(["FT", "AET", "PEN"]);

export const isLive = (short) => LIVE_CODES.has(short);
export const isFinished = (short) => FINISHED_CODES.has(short);

const pad = (n) => String(n).padStart(2, "0");

// The user's LOCAL calendar date (YYYY-MM-DD). toISOString() would give the
// UTC date, which is a day off for part of every evening/morning.
export function localDateISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function userTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function kickoffTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Short label for the time column: kickoff time, live minute, or a result code.
export function statusLabel(fx) {
  const status = fx?.fixture?.status || {};
  switch (status.short) {
    case "NS": return kickoffTime(fx.fixture.date) || "NS";
    case "TBD": return "TBD";
    case "1H": case "2H": case "ET": case "LIVE":
      return status.elapsed != null ? status.elapsed + "'" : "Live";
    case "HT": return "HT";
    case "BT": return "Break";
    case "P": return "Pens";
    case "INT": return "Int.";
    case "FT": return "FT";
    case "AET": return "AET";
    case "PEN": return "Pens";
    case "PST": return "Postp.";
    case "CANC": return "Canc.";
    case "SUSP": return "Susp.";
    case "ABD": return "Aband.";
    case "AWD": return "Awarded";
    case "WO": return "W/O";
    default: return status.short || "";
  }
}

// Longer label for headers, e.g. "63' live", "Full time", "Kick-off 20:45".
export function statusHeadline(fx) {
  const status = fx?.fixture?.status || {};
  if (isLive(status.short)) {
    if (status.short === "HT") return "Half time";
    return (status.elapsed != null ? status.elapsed + "' " : "") + "Live";
  }
  if (status.short === "NS") {
    const t = kickoffTime(fx.fixture.date);
    return t ? "Kick-off " + t : "Not started";
  }
  return status.long || status.short || "Scheduled";
}

// Football seasons are labelled by their start year. Used only as a fallback
// when a league's own "current" season isn't known.
export function currentSeasonYear(now = new Date()) {
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

export function getBestSeason(entry) {
  const seasons = Array.isArray(entry?.seasons) ? entry.seasons.filter((s) => Number.isInteger(s?.year)) : [];
  const current = seasons.find((s) => s.current);
  if (current) return current.year;
  if (seasons.length) return Math.max(...seasons.map((s) => s.year));
  return currentSeasonYear();
}

// "2026/27" for seasons spanning two calendar years, "2026" otherwise.
export function seasonLabel(entry, year) {
  const season = (entry?.seasons || []).find((s) => s.year === year);
  const start = season?.start ? new Date(season.start).getFullYear() : null;
  const end = season?.end ? new Date(season.end).getFullYear() : null;
  if (start && end && end > start) return start + "/" + String(end).slice(2);
  return String(year);
}

const POPULAR_LEAGUE_ORDER = [39, 140, 135, 78, 61, 2, 3, 848, 94, 88, 71, 253, 262];

// Groups a day's fixtures by league (by id, so two "Premier League"s stay
// separate), popular leagues first, kick-off order inside each group.
export function groupByLeague(rows) {
  const map = new Map();
  for (const fx of rows) {
    const key = fx.league?.id ?? fx.league?.name ?? "other";
    if (!map.has(key)) map.set(key, { league: fx.league || {}, items: [] });
    map.get(key).items.push(fx);
  }
  const rank = (id) => {
    const i = POPULAR_LEAGUE_ORDER.indexOf(id);
    return i === -1 ? 999 : i;
  };
  const groups = [...map.values()];
  groups.forEach((g) => g.items.sort((a, b) => (a.fixture?.timestamp || 0) - (b.fixture?.timestamp || 0)));
  groups.sort((a, b) =>
    rank(a.league.id) - rank(b.league.id) ||
    String(a.league.country || "").localeCompare(String(b.league.country || "")) ||
    String(a.league.name || "").localeCompare(String(b.league.name || ""))
  );
  return groups;
}
