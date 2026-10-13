import { roundRectPath, fillRoundRect, loadImage, drawImageCover, drawImageContain, fitText, drawTextCenter, wrapText, font, ensureFontsReady } from "./canvas.js";

export const CARD_W = 1080;
export const CARD_H = 1920;

const PAD = 64;
const RED_DARK = "#8a0000";
const RED = "#d50000";
const RED_BRIGHT = "#ff4d38";
const INK = "#0d0d12";
const INK_DIM = "#6c6c72";

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function formatTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Background gradient + brand watermark shared by every card, and the white
// content panel every card's own content is drawn onto. Returns the panel's
// bounds so callers know where they can draw.
async function drawChrome(ctx, markImg) {
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, RED_BRIGHT);
  bg.addColorStop(0.55, RED);
  bg.addColorStop(1, RED_DARK);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // A couple of soft, oversized circles for depth, kept subtle so they never
  // compete with the content panel.
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(CARD_W + 80, 120, 420, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-120, CARD_H - 160, 360, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (markImg) {
    const h = 64, w = (markImg.width / markImg.height) * h;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(markImg, (CARD_W - w) / 2, 96, w, h);
    ctx.globalAlpha = 1;
  }

  const panel = { x: PAD, y: 280, w: CARD_W - PAD * 2, h: CARD_H - 280 - 200 };
  fillRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 40, "#fff");

  drawTextCenter(ctx, "Scoutwave \u00b7 myscoutwave.com", CARD_W / 2, CARD_H - 90, "600", 28, "rgba(255,255,255,.85)");
  return panel;
}

function statBlock(ctx, cx, y, value, label) {
  drawTextCenter(ctx, String(value ?? "\u2013"), cx, y, "700", 56, INK);
  drawTextCenter(ctx, label, cx, y + 42, "500", 26, INK_DIM);
}

async function newCanvas() {
  await ensureFontsReady();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";
  const mark = await loadImage(location.origin + "/src/assets/scoutwave-mark-white.png").catch(() => null);
  return { canvas, ctx, mark };
}

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------
export async function drawMatchCard(fx) {
  const { canvas, ctx, mark } = await newCanvas();
  const panel = await drawChrome(ctx, mark);
  const cx = CARD_W / 2;
  let y = panel.y + 100;

  drawTextCenter(ctx, (fx.league?.name || "Football").toUpperCase(), cx, y, "700", 30, RED, panel.w - 120);
  if (fx.league?.round) drawTextCenter(ctx, fx.league.round, cx, y + 42, "500", 26, INK_DIM, panel.w - 120);
  y += 140;

  const [home, away] = await Promise.all([loadImage(fx.teams?.home?.logo), loadImage(fx.teams?.away?.logo)]);
  const crest = 220, crestY = y;
  drawImageContain(ctx, home, panel.x + 80, crestY, crest, crest);
  drawImageContain(ctx, away, panel.x + panel.w - 80 - crest, crestY, crest, crest);

  const status = fx.fixture?.status || {};
  const played = ["FT", "AET", "PEN"].includes(status.short);
  const live = ["1H", "2H", "HT", "ET", "BT", "P", "LIVE"].includes(status.short);
  const score = played || live ? `${fx.goals?.home ?? 0} \u2013 ${fx.goals?.away ?? 0}` : "vs";
  drawTextCenter(ctx, score, cx, crestY + crest / 2 + 28, "700", 88, INK);

  const statusLabel = played ? (status.long || "Full time") : live ? (status.elapsed != null ? status.elapsed + "' Live" : "Live") : `Kick-off ${formatTime(fx.fixture?.date)}`;
  drawTextCenter(ctx, statusLabel.toUpperCase(), cx, crestY + crest + 70, "700", 28, live ? RED : INK_DIM);

  y = crestY + crest + 130;
  ctx.font = font("600", 34);
  const nameW = (panel.w - 160) / 2;
  const homeLines = wrapText(ctx, fx.teams?.home?.name || "Home", nameW, 1);
  const awayLines = wrapText(ctx, fx.teams?.away?.name || "Away", nameW, 1);
  drawTextCenter(ctx, homeLines[0], panel.x + 80 + crest / 2, y, "600", 34, INK, nameW);
  drawTextCenter(ctx, awayLines[0], panel.x + panel.w - 80 - crest / 2, y, "600", 34, INK, nameW);

  y += 90;
  ctx.strokeStyle = "rgba(60,60,67,.14)";
  ctx.beginPath(); ctx.moveTo(panel.x + 60, y); ctx.lineTo(panel.x + panel.w - 60, y); ctx.stroke();
  y += 70;

  drawTextCenter(ctx, formatDate(fx.fixture?.date), cx, y, "500", 28, INK_DIM);
  if (fx.fixture?.venue?.name) drawTextCenter(ctx, fx.fixture.venue.name, cx, y + 44, "500", 26, INK_DIM);

  return canvas;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
export async function drawPlayerCard(entry) {
  const { canvas, ctx, mark } = await newCanvas();
  const panel = await drawChrome(ctx, mark);
  const cx = CARD_W / 2;
  const player = entry.player || {};
  const current = (entry.statistics || [])[0];

  const photo = await loadImage(player.photo);
  const photoSize = 320, photoY = panel.y + 70;
  drawImageCover(ctx, photo, cx - photoSize / 2, photoY, photoSize, photoSize, "circle");
  ctx.save();
  ctx.lineWidth = 6; ctx.strokeStyle = "#fff";
  ctx.beginPath(); ctx.arc(cx, photoY + photoSize / 2, photoSize / 2 + 3, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  let y = photoY + photoSize + 90;
  drawTextCenter(ctx, player.name || "Player", cx, y, "700", 56, INK, panel.w - 120);
  y += 54;
  const meta = [player.nationality, current?.games?.position].filter(Boolean).join("  \u00b7  ");
  if (meta) drawTextCenter(ctx, meta, cx, y, "500", 30, INK_DIM, panel.w - 120);

  if (current?.team?.name) {
    y += 70;
    drawTextCenter(ctx, current.team.name + (current.league?.name ? "  \u2014  " + current.league.name : ""), cx, y, "600", 28, RED, panel.w - 120);
  }

  y += 110;
  ctx.strokeStyle = "rgba(60,60,67,.14)";
  ctx.beginPath(); ctx.moveTo(panel.x + 60, y); ctx.lineTo(panel.x + panel.w - 60, y); ctx.stroke();
  y += 110;

  const cols = [panel.x + panel.w * 0.2, cx, panel.x + panel.w * 0.8];
  statBlock(ctx, cols[0], y, current?.games?.appearences, "Apps");
  statBlock(ctx, cols[1], y, current?.goals?.total, "Goals");
  statBlock(ctx, cols[2], y, current?.goals?.assists, "Assists");

  return canvas;
}

// ---------------------------------------------------------------------------
// Club
// ---------------------------------------------------------------------------
export async function drawClubCard(entry) {
  const { canvas, ctx, mark } = await newCanvas();
  const panel = await drawChrome(ctx, mark);
  const cx = CARD_W / 2;
  const team = entry.team || {};
  const venue = entry.venue || {};

  const logo = await loadImage(team.logo);
  const logoSize = 320;
  drawImageContain(ctx, logo, cx - logoSize / 2, panel.y + 80, logoSize, logoSize);

  let y = panel.y + 80 + logoSize + 100;
  drawTextCenter(ctx, team.name || "Club", cx, y, "700", 60, INK, panel.w - 120);

  y += 60;
  const meta = [team.country, team.founded ? "Founded " + team.founded : null].filter(Boolean).join("  \u00b7  ");
  if (meta) drawTextCenter(ctx, meta, cx, y, "500", 30, INK_DIM, panel.w - 120);

  y += 110;
  ctx.strokeStyle = "rgba(60,60,67,.14)";
  ctx.beginPath(); ctx.moveTo(panel.x + 60, y); ctx.lineTo(panel.x + panel.w - 60, y); ctx.stroke();
  y += 90;

  if (venue.name) {
    drawTextCenter(ctx, "HOME GROUND", cx, y, "700", 24, RED);
    y += 50;
    drawTextCenter(ctx, venue.name, cx, y, "600", 36, INK, panel.w - 160);
    if (venue.city) { y += 46; drawTextCenter(ctx, venue.city, cx, y, "500", 28, INK_DIM); }
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Venue
// ---------------------------------------------------------------------------
export async function drawVenueCard(venue) {
  const { canvas, ctx, mark } = await newCanvas();
  const panel = await drawChrome(ctx, mark);
  const cx = CARD_W / 2;

  const photo = await loadImage(venue.image);
  const photoH = 480;
  drawImageCover(ctx, photo, panel.x, panel.y, panel.w, photoH, { tl: 40, tr: 40, bl: 0, br: 0 }, "#e5e5ea");
  if (!photo) {
    ctx.save();
    ctx.fillStyle = INK_DIM;
    ctx.font = font("700", 90);
    ctx.textAlign = "center";
    ctx.fillText("\u{1F3DF}", cx, panel.y + photoH / 2 + 32);
    ctx.restore();
  }

  let y = panel.y + photoH + 100;
  drawTextCenter(ctx, venue.name || "Venue", cx, y, "700", 58, INK, panel.w - 120);

  y += 58;
  const meta = [venue.city, venue.country].filter(Boolean).join(", ");
  if (meta) drawTextCenter(ctx, meta, cx, y, "500", 30, INK_DIM, panel.w - 120);

  y += 110;
  ctx.strokeStyle = "rgba(60,60,67,.14)";
  ctx.beginPath(); ctx.moveTo(panel.x + 60, y); ctx.lineTo(panel.x + panel.w - 60, y); ctx.stroke();
  y += 110;

  const cols = [cx * 0.62, cx * 1.38];
  statBlock(ctx, cols[0], y, venue.capacity ? Number(venue.capacity).toLocaleString() : null, "Capacity");
  statBlock(ctx, cols[1], y, venue.surface ? String(venue.surface).replace(/^./, (c) => c.toUpperCase()) : null, "Surface");

  return canvas;
}

// ---------------------------------------------------------------------------
// League
// ---------------------------------------------------------------------------
export async function drawLeagueCard(entry, leader) {
  const { canvas, ctx, mark } = await newCanvas();
  const panel = await drawChrome(ctx, mark);
  const cx = CARD_W / 2;
  const league = entry.league || {};

  const logo = await loadImage(league.logo);
  const logoSize = 300;
  drawImageContain(ctx, logo, cx - logoSize / 2, panel.y + 80, logoSize, logoSize);

  let y = panel.y + 80 + logoSize + 100;
  drawTextCenter(ctx, league.name || "League", cx, y, "700", 58, INK, panel.w - 120);

  y += 58;
  if (entry.country?.name) drawTextCenter(ctx, entry.country.name, cx, y, "500", 30, INK_DIM, panel.w - 120);

  y += 110;
  ctx.strokeStyle = "rgba(60,60,67,.14)";
  ctx.beginPath(); ctx.moveTo(panel.x + 60, y); ctx.lineTo(panel.x + panel.w - 60, y); ctx.stroke();
  y += 90;

  if (leader?.team?.name) {
    drawTextCenter(ctx, "TOP OF THE TABLE", cx, y, "700", 24, RED);
    y += 56;
    const logoLead = await loadImage(leader.team.logo);
    const s = 72;
    drawImageContain(ctx, logoLead, cx - 180 - s / 2, y - 8, s, s);
    drawTextCenter(ctx, leader.team.name, cx + 30, y + 48, "600", 34, INK, panel.w - 340);
    drawTextCenter(ctx, (leader.points ?? "\u2013") + " PTS", cx, y + 110, "700", 28, INK_DIM);
  }

  return canvas;
}

export async function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))), "image/png", 0.95);
  });
}
