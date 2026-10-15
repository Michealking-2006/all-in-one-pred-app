// Club themes: pick the club you support and the whole app's accent follows it
// (buttons, active tab, links, live indicators, a faint tint on backgrounds).
// Light/dark mode is separate and keeps working: colours are re-derived for
// each so text stays readable.
import { store } from "./store.js";
import { activeFxTheme } from "./themeFx.js";

// Primary = the colour the app is built around. Colours are approximations of
// each club's main brand colour. Use the custom picker for an exact match.
export const CLUBS = [
  { id: "barcelona", name: "Barcelona", primary: "#A50044", secondary: "#004D98" },
  { id: "real-madrid", name: "Real Madrid", primary: "#00529F", secondary: "#FEBE10" },
  { id: "atletico", name: "Atlético Madrid", primary: "#CB3524", secondary: "#272E61" },
  { id: "sevilla", name: "Sevilla", primary: "#D4202C", secondary: "#FFFFFF" },
  { id: "chelsea", name: "Chelsea", primary: "#034694", secondary: "#DBA111" },
  { id: "arsenal", name: "Arsenal", primary: "#EF0107", secondary: "#063672" },
  { id: "man-united", name: "Manchester United", primary: "#DA291C", secondary: "#FBE122" },
  { id: "man-city", name: "Manchester City", primary: "#6CABDD", secondary: "#1C2C5B" },
  { id: "liverpool", name: "Liverpool", primary: "#C8102E", secondary: "#00B2A9" },
  { id: "tottenham", name: "Tottenham", primary: "#132257", secondary: "#FFFFFF" },
  { id: "newcastle", name: "Newcastle", primary: "#241F20", secondary: "#FFFFFF" },
  { id: "aston-villa", name: "Aston Villa", primary: "#670E36", secondary: "#95BFE5" },
  { id: "west-ham", name: "West Ham", primary: "#7A263A", secondary: "#1BB1E7" },
  { id: "everton", name: "Everton", primary: "#003399", secondary: "#FFFFFF" },
  { id: "bayern", name: "Bayern Munich", primary: "#DC052D", secondary: "#0066B2" },
  { id: "dortmund", name: "Borussia Dortmund", primary: "#FDE100", secondary: "#000000" },
  { id: "leverkusen", name: "Bayer Leverkusen", primary: "#E32221", secondary: "#000000" },
  { id: "psg", name: "Paris Saint-Germain", primary: "#004170", secondary: "#DA291C" },
  { id: "marseille", name: "Marseille", primary: "#2FAEE0", secondary: "#FFFFFF" },
  { id: "lyon", name: "Lyon", primary: "#1E3A8A", secondary: "#DA291C" },
  { id: "juventus", name: "Juventus", primary: "#111111", secondary: "#FFFFFF" },
  { id: "inter", name: "Inter Milan", primary: "#0A2C6B", secondary: "#000000" },
  { id: "ac-milan", name: "AC Milan", primary: "#FB090B", secondary: "#000000" },
  { id: "napoli", name: "Napoli", primary: "#12A0D7", secondary: "#FFFFFF" },
  { id: "roma", name: "Roma", primary: "#8E1F2F", secondary: "#F0BC42" },
  { id: "lazio", name: "Lazio", primary: "#87D8F7", secondary: "#FFFFFF" },
  { id: "ajax", name: "Ajax", primary: "#D2122E", secondary: "#FFFFFF" },
  { id: "psv", name: "PSV", primary: "#E30613", secondary: "#FFFFFF" },
  { id: "benfica", name: "Benfica", primary: "#E30613", secondary: "#FFFFFF" },
  { id: "porto", name: "Porto", primary: "#0A3C8D", secondary: "#FFFFFF" },
  { id: "sporting", name: "Sporting CP", primary: "#008057", secondary: "#FFFFFF" },
  { id: "celtic", name: "Celtic", primary: "#16974A", secondary: "#FFFFFF" },
  { id: "rangers", name: "Rangers", primary: "#1B458F", secondary: "#FFFFFF" },
  { id: "galatasaray", name: "Galatasaray", primary: "#A90432", secondary: "#FDB912" },
  { id: "fenerbahce", name: "Fenerbahçe", primary: "#00205B", secondary: "#FFED00" },
  { id: "al-nassr", name: "Al Nassr", primary: "#E5B600", secondary: "#1D3F8F" },
  { id: "inter-miami", name: "Inter Miami", primary: "#F7B5CD", secondary: "#231F20" },
];

export const clubById = (id) => CLUBS.find((club) => club.id === id) || null;
export const isHex = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ""));

// ---------------------------------------------------------------------------
// Colour maths (pure, exported for tests)
// ---------------------------------------------------------------------------
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
export const mix = (a, b, t) => { const x = hexToRgb(a), y = hexToRgb(b); return rgbToHex(x.map((v, i) => v + (y[i] - v) * t)); };
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const rgba = (hex, alpha) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${alpha})`; };

// Walk `color` toward `toward` until it reads on `background` with `min` contrast.
function readable(color, background, toward, min) {
  let out = color;
  for (let i = 0; i < 20 && contrast(out, background) < min; i++) out = mix(out, toward, 0.1);
  return out;
}

// Every colour the app needs, derived from one primary, for light or dark mode.
export function deriveTheme(primary, mode) {
  const dark = mode === "dark";
  const page = dark ? "#000000" : "#f2f2f7";
  const card = dark ? "#1c1c1e" : "#ffffff";
  // Fills (buttons, bars): the club colour, lifted a little in dark mode if it would vanish into black.
  const accent = dark ? readable(primary, "#000000", "#ffffff", 3) : primary;
  const onAccent = contrast("#ffffff", accent) >= 3.6 ? "#ffffff" : "#111111";
  // Small text and icons in the accent colour need real contrast on the surface behind them.
  const accentText = dark ? readable(primary, card, "#ffffff", 4.5) : readable(primary, card, "#000000", 4.5);
  return {
    "--accent": accent,
    "--accent-strong": mix(accent, "#000000", 0.18),
    "--accent-text": accentText,
    "--accent-soft": rgba(accent, dark ? 0.2 : 0.11),
    "--accent-wash": dark ? rgba(accent, 0.14) : mix("#ffffff", accent, 0.06),
    "--on-accent": onAccent,
    "--bg": mix(page, accent, dark ? 0.07 : 0.045),
  };
}

// ---------------------------------------------------------------------------
// Applying it
// ---------------------------------------------------------------------------
let applied = [];

export function applyClubTheme(club) {
  const root = document.documentElement;
  applied.forEach((name) => root.style.removeProperty(name));
  applied = [];
  root.style.removeProperty("--accent"); // also clears the early value the page's boot script sets
  delete root.dataset.club;
  if (!club || !isHex(club.primary)) return;
  const mode = root.dataset.theme === "dark" ? "dark" : "light";
  const vars = deriveTheme(club.primary, mode);
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
    applied.push(name);
  }
  root.dataset.club = club.id || "custom";
}

export function initClubTheme() {
  // An advanced theme brings its own colours; club colours resume when it is switched off.
  const run = () => { const state = store.getState(); applyClubTheme(activeFxTheme(state) ? null : state.clubTheme); };
  run();
  store.subscribe(run);
  // Light/dark can change on its own (system setting); re-derive the colours.
  new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
