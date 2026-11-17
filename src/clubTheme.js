// Club themes: pick one of the four clubs and the whole app wears its colours and crest (buttons, active tab and
// its indicator, links, headers, the sign-in screen, the browser bar, a faint tint on backgrounds). Light/dark mode
// is separate and keeps working: colours are re-derived for each so text stays readable.
import { store } from "./store.js";
import { activeFxTheme } from "./themeFxData.js";
import { REMOTE_EVENT } from "./remoteConfig.js";
import { CLUBS, CLUB_IDS, clubById, isHex } from "./clubs.js";

export { CLUBS, CLUB_IDS, clubById, isHex };

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

// Every colour the app needs, derived from one primary, for light or dark mode. These are the same tokens the base
// stylesheet defines for the standard red, so every screen follows without any per-screen rules.
export function deriveTheme(primary, mode) {
  const dark = mode === "dark";
  const card = dark ? "#1c1c1e" : "#ffffff";
  // Fills (buttons, bars, avatars): the club colour, lifted a little in dark mode if it would vanish into black.
  const accent = dark ? readable(primary, "#000000", "#ffffff", 3) : primary;
  const onAccent = contrast("#ffffff", accent) >= 3.6 ? "#ffffff" : "#111111";
  // Small text and icons in the accent colour need real contrast on the surface behind them.
  const accentText = dark ? readable(primary, card, "#ffffff", 4.5) : readable(primary, card, "#000000", 4.5);
  return {
    "--accent": accent,
    "--accent-strong": mix(accent, "#000000", 0.18),
    "--accent-lift": mix(accent, "#ffffff", 0.2), // the light end of icon tiles, avatars and hero gradients
    "--accent-text": accentText,
    "--accent-soft": rgba(accent, dark ? 0.2 : 0.11),
    "--accent-wash": dark ? rgba(accent, 0.14) : mix("#ffffff", accent, 0.06),
    "--accent-glow": rgba(accent, dark ? 0.4 : 0.28),
    "--on-accent": onAccent,
  };
}

// The club identity: the accent set above plus the club's second colour and its crest.
//   --club-2 / --on-club-2   the second colour as a fill, and the text that sits on it
//   --club-2-text            the second colour as small text on a card (walked toward black/white until readable)
//   --club-glow              a soft wash of the primary behind the large headers
//   --club-crest             the club's real crest as a CSS url()
export function deriveClubTheme(club, mode) {
  const vars = deriveTheme(club.primary, mode);
  const dark = mode === "dark";
  const card = dark ? "#1c1c1e" : "#ffffff";
  const second = dark ? readable(club.secondary, "#000000", "#ffffff", 3) : club.secondary;
  return {
    ...vars,
    "--club-2": second,
    "--on-club-2": contrast("#ffffff", second) >= 3.6 ? "#ffffff" : "#111111",
    "--club-2-text": dark ? readable(club.secondary, card, "#ffffff", 4.5) : readable(club.secondary, card, "#000000", 4.5),
    "--club-glow": rgba(vars["--accent"], dark ? 0.3 : 0.16),
    "--club-crest": `url("${club.logo}")`,
  };
}

// ---------------------------------------------------------------------------
// Applying it
// ---------------------------------------------------------------------------
let applied = [];
let lastKey = "";

export function applyClubTheme(saved) {
  const root = document.documentElement;
  // Club + light/dark is what the colours depend on. (The key must not include html[data-club]: that is set below, so a key
  // that read it would never match the next call and every store change would rewrite all the variables.)
  const key = (saved && saved.id || "") + "|" + root.dataset.theme;
  if (saved && key === lastKey && root.dataset.club === saved.id) return; // same club, same mode, already applied
  lastKey = key;
  applied.forEach((name) => root.style.removeProperty(name));
  applied = [];
  root.style.removeProperty("--accent"); // also clears the early value the page's boot script sets
  delete root.dataset.club;
  const mode = root.dataset.theme === "dark" ? "dark" : "light";
  const club = saved && clubById(saved.id);
  if (!club) return;
  for (const [name, value] of Object.entries(deriveClubTheme(club, mode))) {
    root.style.setProperty(name, value);
    applied.push(name);
  }
  root.dataset.club = club.id;
}

// Change the club without redrawing the screen (the sign-up form must keep what was typed): saved and applied now.
export function previewClub(club) {
  initClubTheme(); // so later changes (dark mode, an advanced theme) keep the colours right
  store.setState({ clubTheme: club ? { id: club.id, primary: club.primary } : null }, { silent: true });
  applyClubTheme(store.getState().clubTheme);
}

let started = false;
export function initClubTheme() {
  if (started) return;
  started = true;
  // An advanced theme brings its own colours; club colours resume when it is switched off.
  const run = () => { const state = store.getState(); applyClubTheme(activeFxTheme(state) ? null : state.clubTheme); };
  run();
  store.subscribe(run);
  window.addEventListener(REMOTE_EVENT, run);
  // Light/dark can change on its own (system setting); re-derive the colours.
  new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
