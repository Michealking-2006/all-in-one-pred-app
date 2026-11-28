import { clubFromSaved } from "./clubs.js";

// A club's two colours, read from its crest. The football data service gives a name and a crest for every club but no
// colours, so the crest is sampled (it is the one place a club's real colours are guaranteed to be). Pure colour picking
// is separate from the image reading so it can be tested without a browser; if the image can't be read (offline, blocked)
// a pair of colours is made from the club's name instead, so choosing a club never fails.
const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (hue * 60 + 360) % 360, s, l };
}
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// rgba: a flat array of r,g,b,a values (what a canvas gives back). Returns { primary, secondary } as #RRGGBB.
export function pickColors(rgba) {
  const buckets = new Map(); // 4 bits per channel
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a < 160) continue; // see-through edge of the crest
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const slot = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    slot.n++; slot.r += r; slot.g += g; slot.b += b;
    buckets.set(key, slot);
  }
  const all = [...buckets.values()].map((s) => {
    const r = s.r / s.n, g = s.g / s.n, b = s.b / s.n;
    return { n: s.n, r, g, b, ...hsl(r, g, b) };
  });
  if (!all.length) return null;
  const total = all.reduce((sum, c) => sum + c.n, 0);
  // Colourful, not too pale and not near-black: those are the club's identity. White, grey and black are kept apart.
  const colourful = all.filter((c) => c.s >= 0.28 && c.l > 0.12 && c.l < 0.86).sort((x, y) => y.n * (0.6 + y.s) - x.n * (0.6 + x.s));
  const neutrals = all.filter((c) => c.s < 0.28 || c.l <= 0.12 || c.l >= 0.86).sort((x, y) => y.n - x.n);

  // Merge near-identical shades so "the same blue" in two buckets doesn't take both places.
  const distinct = [];
  for (const c of colourful) {
    const twin = distinct.find((d) => hueGap(d.h, c.h) < 22 && Math.abs(d.l - c.l) < 0.28);
    if (twin) { twin.n += c.n; continue; }
    distinct.push({ ...c });
  }
  distinct.sort((x, y) => y.n - x.n);

  let primary = distinct[0];
  if (!primary) { // a black-and-white crest (Juventus, Newcastle ...): black is the colour, white the second
    const dark = neutrals.filter((c) => c.l < 0.5).sort((x, y) => y.n - x.n)[0];
    primary = dark && dark.n > total * 0.12 ? dark : { r: 26, g: 26, b: 26 };
    return { primary: toHex(primary.r, primary.g, primary.b), secondary: "#FFFFFF" };
  }
  // The second colour: another real colour that takes a fair share of the crest, otherwise gold/white/black as the crest has it.
  let secondary = distinct.slice(1).find((c) => c.n >= total * 0.05 && (hueGap(c.h, primary.h) >= 30 || Math.abs(c.l - primary.l) >= 0.25));
  if (!secondary) {
    const light = neutrals.filter((c) => c.l >= 0.86)[0], dark = neutrals.filter((c) => c.l <= 0.12)[0];
    secondary = primary.l < 0.45 ? (light || { r: 255, g: 255, b: 255 }) : (dark || { r: 26, g: 26, b: 26 });
  }
  return { primary: toHex(primary.r, primary.g, primary.b), secondary: toHex(secondary.r, secondary.g, secondary.b) };
}

// Colours made from a name alone (always the same for the same name): used only when the crest can't be read.
export function colorsFromName(name) {
  let hash = 0;
  for (const ch of String(name || "club")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360, hue2 = (hue + 35) % 360;
  const rgb = (hh, s, l) => {
    const k = (n) => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
  };
  return { primary: rgb(hue, 0.65, 0.34), secondary: rgb(hue2, 0.75, 0.55) };
}

const cache = new Map(); // crest url -> colours, for this visit
const SIZE = 48;

// Reads the crest through the app's own image route (so the canvas can be read: a plain cross-site image would taint it).
export function crestColors(logoUrl, name) {
  const key = String(logoUrl || "");
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  const fallback = () => colorsFromName(name);
  if (typeof document === "undefined" || !key) return Promise.resolve(fallback());
  return new Promise((resolve) => {
    const done = (colors) => { cache.set(key, colors); resolve(colors); };
    const img = new Image();
    const timer = window.setTimeout(() => done(fallback()), 6000);
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const scale = Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight) || 1;
        const w = Math.max(1, Math.round(img.naturalWidth * scale)), hgt = Math.max(1, Math.round(img.naturalHeight * scale));
        ctx.drawImage(img, (SIZE - w) / 2, (SIZE - hgt) / 2, w, hgt);
        done(pickColors(ctx.getImageData(0, 0, SIZE, SIZE).data) || fallback());
      } catch { done(fallback()); }
    };
    img.onerror = () => { window.clearTimeout(timer); done(fallback()); };
    img.decoding = "async";
    img.src = "/api/image-proxy?url=" + encodeURIComponent(key);
  });
}

// A club from a search result ({ team: { id, name, code, country, logo } }) plus its two colours, in the saved form.
export function clubFromTeam(team, { primary, secondary }) {
  return clubFromSaved({ id: "t-" + Number(team?.id), name: team?.name, short: team?.code, motto: team?.country, logo: team?.logo, primary, secondary });
}
