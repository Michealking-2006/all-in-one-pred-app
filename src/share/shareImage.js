import { drawMatchCard, drawPlayerCard, drawClubCard, drawVenueCard, drawLeagueCard, canvasToBlob } from "./cards.js";

const DRAWERS = {
  match: drawMatchCard,
  player: drawPlayerCard,
  club: drawClubCard,
  venue: drawVenueCard,
  league: drawLeagueCard,
};

// Builds the branded PNG for one entity. `data` is whatever raw shape that
// entity's own page already has in memory (fixture / {player,statistics} /
// {team,venue} / venue / {league,country}) — see cards.js for exact fields.
// `extra` is optional supplementary data a card can use if already on hand
// (e.g. the league leader for the "top of the table" line) but never fetches
// itself, so sharing never costs an API call beyond what the page already made.
export async function generateShareImage(type, data, extra) {
  const draw = DRAWERS[type];
  if (!draw) throw new Error("Unknown share card type: " + type);
  const canvas = await draw(data, extra);
  return canvasToBlob(canvas);
}

function filenameFor(type) {
  return `scoutwave-${type}-${Date.now()}.png`;
}

// true if the platform can share an actual image file (not just a link/text) —
// this is the real support test; navigator.share existing is not enough, as
// some browsers have it but reject files.
export function canShareFiles() {
  if (!navigator.canShare || !navigator.share) return false;
  try {
    const probe = new File([""], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareImageFile(blob, type, title) {
  const file = new File([blob], filenameFor(type), { type: "image/png" });
  await navigator.share({ files: [file], title: title || "Scoutwave" });
}

export function downloadImageFile(blob, type) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFor(type);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
