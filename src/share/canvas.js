// Small, dependency-free canvas drawing primitives shared by every share-card
// type in cards.js. Nothing here knows about matches/players/etc — it only
// knows how to draw rounded rectangles, fit text, and load images safely.

const FONT = "DM Sans";
// Generic fallbacks after the web font: without them a canvas whose font failed to load (data saver, 1 GB phone,
// offline) falls back to the browser's default font, which is usually a serif.
const FONT_FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FONT_CSS_URL = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap";

// The app itself uses the phone's own font and loads no web font, so on a card exported
// early (or on those phones) the stylesheet may not exist yet. Add it now, because the person asked for an image.
function ensureFontStylesheet() {
  if (document.querySelector('link[href*="fonts.googleapis.com"]')) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_CSS_URL;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
    setTimeout(resolve, 3000); // never hold up sharing for a slow network
  });
}

// The app's real font stack leads with the device's native system font (so
// the UI feels at home on each platform) — but an exported, shared image
// should look identical everywhere it lands, so cards are drawn with the one
// web font actually loaded via Google Fonts (index.html), not the system one.
export async function ensureFontsReady() {
  const specs = ["400 32px", "500 32px", "600 32px", "700 32px"].map((s) => `${s} "${FONT}"`);
  try {
    await ensureFontStylesheet();
    await Promise.all(specs.map((spec) => document.fonts.load(spec)));
    await document.fonts.ready;
  } catch {
    // Fonts API not available or a font failed to load: canvas still falls
    // back to a generic sans-serif rather than throwing, so sharing still works.
  }
}

export function font(weight, size) {
  return `${weight} ${size}px "${FONT}", ${FONT_FALLBACK}`;
}

export function roundRectPath(ctx, x, y, w, h, radius) {
  const r = typeof radius === "number" ? { tl: radius, tr: radius, br: radius, bl: radius } : radius;
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
  ctx.lineTo(x + r.bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.arcTo(x, y, x + r.tl, y, r.tl);
  ctx.closePath();
}

export function fillRoundRect(ctx, x, y, w, h, radius, fillStyle) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

// Loads an image through the app's own same-origin image proxy (see
// api/image-proxy.js) so it's always safe to draw onto canvas and export —
// never loaded directly from the remote host, regardless of that host's own
// CORS headers. Resolves to null (never rejects) on failure, so one missing
// crest/photo degrades to a placeholder instead of failing the whole card.
export function loadImage(remoteUrl) {
  return new Promise((resolve) => {
    if (!remoteUrl) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/api/image-proxy?url=" + encodeURIComponent(remoteUrl);
  });
}

// Draws `img` to cover [x,y,w,h] (like CSS object-fit: cover), clipped to an
// optionally rounded (or fully circular) region. Draws a plain fallback tile
// instead when img is null, so a missing image never leaves a blank hole.
export function drawImageCover(ctx, img, x, y, w, h, radius, fallbackFill = "#e5e5ea") {
  ctx.save();
  if (radius === "circle") {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.clip();
  } else if (radius) {
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
  }
  if (img) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = fallbackFill;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// Draws `img` centered and contained within [x,y,w,h] (like object-fit:
// contain) — used for crests/logos, which usually have transparent padding
// and look wrong cropped.
export function drawImageContain(ctx, img, x, y, w, h, fallbackFill = "#e5e5ea") {
  if (!img) { fillRoundRect(ctx, x, y, w, h, 12, fallbackFill); return; }
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// Shrinks the font size (down to minSize) until `text` fits in maxWidth.
// Returns the size actually used, having already set ctx.font to it.
export function fitText(ctx, text, maxWidth, weight, startSize, minSize = 20) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = font(weight, size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = font(weight, size);
  return size;
}

export function drawTextCenter(ctx, text, cx, y, weight, size, color, maxWidth) {
  ctx.fillStyle = color;
  if (maxWidth) fitText(ctx, text, maxWidth, weight, size);
  else ctx.font = font(weight, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, cx, y);
}

// Wraps `text` across at most maxLines lines within maxWidth, ellipsising the
// last line if it still doesn't fit. Returns the lines actually drawn.
export function wrapText(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const attempt = line ? line + " " + word : word;
    if (ctx.measureText(attempt).width <= maxWidth || !line) {
      line = attempt;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line) lines.push(line);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "\u2026").width > maxWidth && last.length > 1) last = last.slice(0, -1);
    lines[maxLines - 1] = last.length < (words.at(-1) || "").length ? last + "\u2026" : last;
  }
  return lines;
}
