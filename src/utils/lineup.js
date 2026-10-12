// Pure helpers for drawing a starting XI on a pitch (no DOM, easy to test).

export function parseGrid(grid) {
  const match = /^(\d+):(\d+)$/.exec(String(grid ?? "").trim());
  return match ? { row: Number(match[1]), col: Number(match[2]) } : null;
}

// "4-2-3-1" -> [1, 4, 2, 3, 1] (goalkeeper first). null if it doesn't add up to 11.
export function formationRows(formation) {
  const parts = String(formation ?? "").split("-").map((n) => parseInt(n, 10));
  if (!parts.length || parts.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  const rows = [1, ...parts];
  return rows.reduce((a, b) => a + b, 0) === 11 ? rows : null;
}

// Returns rows of players from goalkeeper to attack, each row left -> right
// (as seen when the team attacks up the pitch).
//   1) use the provider's grid ("row:col") when every player has one
//   2) otherwise apply the formation to the lineup order
//   3) otherwise group by position letter (G / D / M / F)
export function arrangeRows(startXI, formation) {
  const players = (startXI || []).map((entry) => entry?.player || entry).filter(Boolean);
  if (!players.length) return [];

  const gridded = players.map((player) => ({ player, grid: parseGrid(player.grid) }));
  if (gridded.every((item) => item.grid)) {
    const byRow = new Map();
    for (const { player, grid } of gridded) {
      if (!byRow.has(grid.row)) byRow.set(grid.row, []);
      byRow.get(grid.row).push({ player, col: grid.col });
    }
    return [...byRow.keys()]
      .sort((a, b) => a - b)
      .map((row) => byRow.get(row).sort((a, b) => a.col - b.col).map((item) => item.player));
  }

  const rows = formationRows(formation);
  if (rows && players.length === 11) {
    let index = 0;
    return rows.map((count) => players.slice(index, (index += count)));
  }

  const order = ["G", "D", "M", "F"];
  const groups = order.map((pos) => players.filter((p) => p.pos === pos)).filter((g) => g.length);
  const rest = players.filter((p) => !order.includes(p.pos));
  if (rest.length) groups.push(rest);
  return groups;
}

// Coordinates in percent of the whole pitch. The pitch is drawn vertically:
// the AWAY side defends the bottom goal and attacks up (standard orientation),
// the HOME side is the same picture rotated 180° at the top, so both teams face
// each other and each keeper stands in front of his own goal.
export function layoutSide(rows, side) {
  const out = [];
  const count = rows.length;
  rows.forEach((row, r) => {
    const depth = count <= 1 ? 0 : r / (count - 1); // 0 = keeper, 1 = most advanced line
    const yStd = 91 - depth * 35.5;
    row.forEach((player, i) => {
      const xStd = 5 + ((i + 1) / (row.length + 1)) * 90;
      // `span` = horizontal room (percent of pitch width) this marker may use, so
      // neighbouring name labels in a crowded row never overlap.
      out.push({ player, x: side === "home" ? 100 - xStd : xStd, y: side === "home" ? 100 - yStd : yStd, span: 90 / (row.length + 1) });
    });
  });
  return out;
}

// ------------------------------------------------------------------ colours
const HEX = /^#?([0-9a-f]{6})$/i;

export function hexOrNull(value) {
  const match = HEX.exec(String(value ?? "").trim());
  return match ? "#" + match[1].toLowerCase() : null;
}

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function distance(a, b) {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

const FALLBACK = { home: "#d50000", away: "#16233f" };

// Kit colours for a team's markers, guaranteeing a readable number and that the
// two teams don't end up the same colour. `team.colors` comes from the API and
// is often missing or malformed.
export function kitFor(team, side, opponentPrimary = null) {
  const supplied = team?.colors?.player || {};
  let primary = hexOrNull(supplied.primary) || FALLBACK[side];
  if (opponentPrimary && distance(primary, opponentPrimary) < 70) {
    primary = distance(FALLBACK[side], opponentPrimary) >= 70 ? FALLBACK[side] : side === "home" ? "#f2f2f7" : "#111114";
  }
  let number = hexOrNull(supplied.number);
  if (!number || contrastRatio(primary, number) < 3) number = luminance(primary) > 0.5 ? "#111114" : "#ffffff";
  const border = hexOrNull(supplied.border) || (luminance(primary) > 0.75 ? "#c7c7cc" : "rgba(255,255,255,.85)");
  return { primary, number, border };
}

// Short label under a marker: the surname ("J. Pickford" -> "Pickford").
export function shortName(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}
