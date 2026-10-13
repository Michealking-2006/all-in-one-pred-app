// Live-match feedback: vibrate on a goal, blow a whistle at half time and full
// time. Works while the app is open, on the match page being watched and on
// starred matches in the Games list (there is no background push yet).
import { store } from "./store.js";
import { showToast } from "./toast.js";
import { isLive, isFinished } from "./utils/fixtures.js";

const seen = new Map(); // fixtureId -> { status, goals }

// First sighting of a fixture only records it; alerts need a change between two
// sightings, so opening an old match never replays its goals.
export function detectEvents(rows, { only = null } = {}) {
  const events = [];
  for (const fx of Array.isArray(rows) ? rows : []) {
    const id = fx?.fixture?.id;
    if (!id || (only && !only.includes(id))) continue;
    const status = fx.fixture?.status?.short || "";
    const goals = (fx.goals?.home ?? 0) + (fx.goals?.away ?? 0);
    const prev = seen.get(id);
    seen.set(id, { status, goals });
    if (!prev) continue;
    if (goals > prev.goals && (isLive(status) || isFinished(status))) events.push({ type: "goal", fx });
    if (status !== prev.status) {
      if (status === "HT" && isLive(prev.status) && prev.status !== "HT") events.push({ type: "half", fx });
      else if (isFinished(status) && isLive(prev.status)) events.push({ type: "full", fx });
    }
  }
  return events;
}

export function resetLiveAlerts() {
  seen.clear();
}

const scoreLine = (fx) => `${fx.teams?.home?.name || "Home"} ${fx.goals?.home ?? 0}\u2013${fx.goals?.away ?? 0} ${fx.teams?.away?.name || "Away"}`;

export function observeFixtures(rows, options) {
  const events = detectEvents(rows, options);
  if (!events.length) return events;
  const prefs = store.getState().notificationPrefs || {};
  let vibrated = false, whistled = false;
  for (const event of events) {
    if (event.type === "goal") {
      showToast("Goal! " + scoreLine(event.fx), "success", 4000);
      if (prefs.goalVibration !== false && !vibrated) vibrated = vibrate([180, 90, 180, 90, 420]);
    } else if (event.type === "half") {
      showToast("Half time: " + scoreLine(event.fx), "default", 4000);
      if (prefs.whistles !== false && !whistled) whistled = whistle("half");
    } else {
      showToast("Full time: " + scoreLine(event.fx), "default", 4000);
      if (prefs.whistles !== false && !whistled) whistled = whistle("full");
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Haptics + sound
// ---------------------------------------------------------------------------
export function vibrate(pattern) {
  try {
    return typeof navigator.vibrate === "function" ? !!navigator.vibrate(pattern) : false;
  } catch {
    return false;
  }
}

let ctx = null;
function audioContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch { ctx = null; }
  return ctx;
}

// Browsers only let audio start after a tap. Prepare the context on the first
// gesture so a whistle later (with no tap involved) can actually sound.
export function initLiveAlerts() {
  const unlock = () => {
    const c = audioContext();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    if (c.state === "running") ["pointerdown", "touchend", "keydown"].forEach((name) => window.removeEventListener(name, unlock));
  };
  ["pointerdown", "touchend", "keydown"].forEach((name) => window.addEventListener(name, unlock, { passive: true }));
}

// One referee blast: a ~2.9 kHz tone warbled by two slow oscillators gives the
// pea-whistle trill, with a quick attack and release so it doesn't click.
function blast(c, start, length) {
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(0.3, start + 0.025);
  master.gain.setValueAtTime(0.3, Math.max(start + 0.03, start + length - 0.06));
  master.gain.exponentialRampToValueAtTime(0.0001, start + length);
  master.connect(c.destination);

  const tone = c.createOscillator();
  tone.type = "sine";
  tone.frequency.value = 2900;
  const warble = c.createOscillator();
  warble.frequency.value = 32;
  const warbleDepth = c.createGain();
  warbleDepth.gain.value = 120;
  warble.connect(warbleDepth);
  warbleDepth.connect(tone.frequency);

  const pea = c.createGain();
  pea.gain.value = 0.72;
  const rattle = c.createOscillator();
  rattle.frequency.value = 38;
  const rattleDepth = c.createGain();
  rattleDepth.gain.value = 0.28;
  rattle.connect(rattleDepth);
  rattleDepth.connect(pea.gain);

  tone.connect(pea);
  pea.connect(master);
  [tone, warble, rattle].forEach((osc) => { osc.start(start); osc.stop(start + length + 0.05); });
}

// Half time: two blasts. Full time: short, short, long.
const PATTERNS = {
  half: [[0, 0.32], [0.46, 0.7]],
  full: [[0, 0.28], [0.42, 0.28], [0.84, 0.95]],
};

export function whistle(kind) {
  const c = audioContext();
  if (!c || c.state !== "running") return false; // never tapped yet, or audio unavailable
  const t0 = c.currentTime + 0.03;
  for (const [offset, length] of PATTERNS[kind] || PATTERNS.full) blast(c, t0 + offset, length);
  return true;
}
