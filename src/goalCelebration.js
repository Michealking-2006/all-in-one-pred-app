// A short celebration when the supporter's own club scores: the crest pops in a ring of the club's second colour, the
// score is shown, and confetti in the club's colours bursts out. It loads only when such a goal actually happens
// (liveAlerts.js imports it on demand). Presentation only: the layer ignores touches except to dismiss itself.
import { h, text } from "./utils/h.js";
import { isLowEnd } from "./perf.js";
import { clubById } from "./clubs.js";

const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The colours that read as "this club": its two brand colours plus white and a lighter tint of the first.
export function confettiColors(club) {
  const lift = (hex, t) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0"); return "#" + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255); };
  return [club.primary, club.secondary, "#ffffff", lift(club.primary, 0.45), club.secondary];
}

// Pure and seeded by `rand`, so a test can check the shape of the burst. Each piece flies up and out in a cone, then
// falls. Distances are in CSS pixels, angles in radians.
export function confettiPieces(colors, count, rand = Math.random) {
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (rand() - 0.5) * 2.2; // straight up, +/- ~63 degrees
    const reach = 110 + rand() * 170;
    const ux = Math.cos(angle) * reach, uy = Math.sin(angle) * reach;
    pieces.push({
      ux: Math.round(ux), uy: Math.round(uy),
      x: Math.round(ux * 1.25 + (rand() - 0.5) * 60), fall: Math.round(300 + rand() * 360),
      rot: Math.round((rand() < 0.5 ? -1 : 1) * (360 + rand() * 540)),
      w: Math.round(6 + rand() * 5), len: Math.round(9 + rand() * 6),
      round: rand() < 0.25, delay: +(rand() * 0.12).toFixed(2), dur: +(1.9 + rand() * 0.9).toFixed(2),
      color: colors[i % colors.length],
    });
  }
  return pieces;
}

// Did the supporter's own club (the one picked in Appearance) score? `club` is an entry of clubs.js or null.
export function ownClubScored(event, club) {
  if (!club || event?.type !== "goal") return false;
  const home = event.fx?.teams?.home?.id, away = event.fx?.teams?.away?.id;
  const mine = home === club.teamId ? "home" : away === club.teamId ? "away" : null;
  return !!mine && (event.side === mine || event.side === "both");
}

// Called by liveAlerts for every goal while a club is picked: celebrate it if it was theirs, otherwise the usual banner.
export function onGoal(event, clubId, { plain, buzz }) {
  const club = clubById(clubId);
  if (!ownClubScored(event, club)) { plain(); return; }
  celebrate({ club, fx: event.fx });
  buzz([120, 60, 120, 60, 120, 60, 520]); // a longer, rising buzz for your own club
}

let layer = null, timer = null;

function dismiss() {
  window.clearTimeout(timer);
  const el = layer;
  layer = null;
  if (!el?.isConnected) return;
  el.classList.add("leaving");
  window.setTimeout(() => el.remove(), 260);
}

export function celebrate({ club, fx }) {
  if (!club || !fx) return null;
  dismiss();
  const home = fx.teams?.home?.name || "Home", away = fx.teams?.away?.name || "Away";
  const score = `${home} ${fx.goals?.home ?? 0}\u2013${fx.goals?.away ?? 0} ${away}`;
  const minute = fx.fixture?.status?.elapsed;

  const burst = h("div", { className: "gc-burst", "aria-hidden": "true" });
  if (!reducedMotion() && !isLowEnd()) {
    for (const p of confettiPieces(confettiColors(club), 30)) {
      burst.appendChild(h("span", {
        className: "gc-piece" + (p.round ? " round" : ""),
        style: { "--ux": p.ux + "px", "--uy": p.uy + "px", "--x": p.x + "px", "--fall": p.fall + "px", "--r": p.rot + "deg", "--c": p.color, "--d": p.dur + "s", "--delay": p.delay + "s", width: p.w + "px", height: (p.round ? p.w : p.len) + "px" },
      }));
    }
  }

  const card = h("button", { type: "button", className: "gc-card", "aria-label": "Goal for " + club.name + ". " + score + ". Tap to close.", onClick: dismiss }, [
    h("span", { className: "gc-crest" }, [h("img", { src: club.logo, alt: "", width: "76", height: "76", decoding: "async" })]),
    text("strong", { className: "gc-title" }, "Goal!"),
    text("span", { className: "gc-score" }, score),
    minute ? text("span", { className: "gc-minute" }, minute + "'") : null,
  ]);

  layer = h("div", { className: "goal-celebration", role: "status", "aria-live": "assertive", style: { "--gc-a": club.primary, "--gc-b": club.secondary } }, [burst, card]);
  document.body.appendChild(layer);
  timer = window.setTimeout(dismiss, 3800);
  return layer;
}
