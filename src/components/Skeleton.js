import { h } from "../utils/h.js";

// ============================================================================
// Loading-state system
//
//   1. Primitives       Skeleton(), SkeletonImage()
//   2. Layout presets   SkeletonRow / List / MatchList / Cards / Tiles / Hero /
//                       Table / Stats / Lineup / MatchHero / SeasonBar / Page
//   3. Lookup           skeletonFor("table") -> preset by name (used by the
//                       tabbed pages and sections so each loading state matches
//                       the layout that replaces it)
//
// All visuals live in the "Skeleton system" block of theme.css (tokens
// --sk-base / --sk-shine, so light and dark themes share one implementation).
// Presets are decorative: aria-hidden, and the container that hosts them sets
// aria-busy while it loads.
// ============================================================================

// Tracks which image URLs have successfully loaded at least once. Every
// store.setState rebuilds the whole DOM tree (see App.js render()), so an
// already-loaded avatar gets a brand-new <img> element on every unrelated
// re-render — without this cache, that would flash the skeleton again each
// time, even though the browser already has the image and loads it near-
// instantly. Checking this cache lets an already-seen image skip the
// skeleton entirely, while one still genuinely in flight keeps showing it
// uninterrupted until its own load/error event fires.
const loadedSrcs = new Set();

// ---------------------------------------------------------------------------
// 1. Primitives
// ---------------------------------------------------------------------------

// Generic placeholder. Give it real dimensions via style (legacy API, still
// used for one-off shapes): Skeleton({ style: { width: "60%", height: "12px" } })
export function Skeleton({ style = {}, className = "" } = {}) {
  return h("div", { className: ("skeleton " + className).trim(), style: { display: "block", ...style } });
}

const line = (width, size = "") => h("span", { className: ("skeleton sk-line " + size).trim(), style: { width } });
const block = (className, style) => h("span", { className: "skeleton " + className, style });

// Image-specific skeleton: shows the shimmer placeholder until the real
// image has fully loaded, then swaps to it — and skips the shimmer
// entirely on repeat mounts of a URL that's already loaded successfully.
export function SkeletonImage({ src, alt = "", size = 64, radius = "50%" }) {
  const alreadyLoaded = loadedSrcs.has(src);

  const wrapper = h("div", { style: { position: "relative", width: `${size}px`, height: `${size}px`, flexShrink: "0", borderRadius: radius } });

  const skeleton = h("div", {
    className: "skeleton",
    style: { position: "absolute", inset: "0", borderRadius: radius, display: alreadyLoaded ? "none" : "block" },
  });

  const img = h("img", {
    src,
    alt,
    style: {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      borderRadius: radius,
      opacity: alreadyLoaded ? "1" : "0",
      transition: alreadyLoaded ? "none" : "opacity 0.2s ease",
    },
    onLoad: () => {
      loadedSrcs.add(src);
      img.style.opacity = "1";
      skeleton.style.display = "none";
    },
    onError: () => {
      // fall back to a plain empty circle rather than a broken-image icon
      skeleton.style.display = "none";
    },
  });

  wrapper.appendChild(skeleton);
  wrapper.appendChild(img);
  return wrapper;
}

// ---------------------------------------------------------------------------
// 2. Layout presets
// ---------------------------------------------------------------------------
const decorative = (node) => { node.setAttribute("aria-hidden", "true"); return node; };

// One list row: avatar + text lines (+ trailing value).
export function SkeletonRow({ avatar = "square", lines = 2, trailing = false } = {}) {
  const widths = ["58%", "36%", "44%"];
  return h("div", { className: "sk-row" }, [
    avatar === "none" ? null : block("sk-avatar" + (avatar === "round" ? " round" : "")),
    h("span", { className: "sk-row-copy" }, Array.from({ length: lines }, (_, i) => line(widths[i % widths.length], i ? "sm" : ""))),
    trailing ? block("sk-line sk-trailing") : null,
  ]);
}

// Grouped card of rows (leagues, squad, transfers, search results...).
export function SkeletonList({ rows = 4, avatar = "square", lines = 2, trailing = false } = {}) {
  return decorative(h("div", { className: "card sk-list" }, Array.from({ length: rows }, () => SkeletonRow({ avatar, lines, trailing }))));
}

// Home / favourites: league cards holding match rows.
export function SkeletonMatchList({ leagues = 2, rows = 3 } = {}) {
  const teamRow = (width) => h("span", { className: "sk-team" }, [block("sk-avatar sm"), line(width)]);
  const league = (count) => h("section", { className: "card sk-league" }, [
    h("header", { className: "sk-league-head" }, [block("sk-avatar sm"), line("38%"), block("sk-pill")]),
    ...Array.from({ length: count }, (_, i) => h("div", { className: "sk-match-row" }, [
      line("34px", "sm"),
      h("span", { className: "sk-teams" }, [teamRow(i % 2 ? "52%" : "64%"), teamRow(i % 2 ? "60%" : "46%")]),
    ])),
  ]);
  return decorative(h("div", { className: "sk-matches" }, Array.from({ length: leagues }, (_, i) => league(i === 0 ? rows : Math.max(2, rows - 1)))));
}

// Stand-alone content cards (fixtures, predictions, form...).
export function SkeletonCards({ count = 2 } = {}) {
  return decorative(h("div", { className: "sk-cards" }, Array.from({ length: count }, () =>
    h("div", { className: "card sk-card" }, [line("30%", "sm"), line("78%", "lg"), line("52%")])
  )));
}

// Big-number tiles.
export function SkeletonTiles({ count = 4 } = {}) {
  return decorative(h("div", { className: "sk-tiles", "data-count": String(count) }, Array.from({ length: count }, () =>
    h("div", { className: "card sk-tile" }, [line("52%", "xl"), line("70%", "sm")])
  )));
}

// Entity header: crest / photo, title, meta.
export function SkeletonHero({ shape = "crest" } = {}) {
  return decorative(h("div", { className: "sk-hero" }, [block("sk-hero-img " + shape), line("52%", "lg"), line("32%", "sm")]));
}

// League table.
export function SkeletonTable({ rows = 8 } = {}) {
  return decorative(h("div", { className: "card sk-table" }, [
    h("div", { className: "sk-table-head" }, [line("100%", "sm")]),
    ...Array.from({ length: rows }, () => h("div", { className: "sk-table-row" }, [
      line("14px", "sm"), block("sk-avatar sm"), line("46%"), h("span", { className: "sk-table-nums" }, [line("18px", "sm"), line("18px", "sm"), line("22px", "sm")]),
    ])),
  ]));
}

// Label + bar rows (match statistics, formations).
export function SkeletonStats({ rows = 5 } = {}) {
  return decorative(h("div", { className: "card sk-stats" }, Array.from({ length: rows }, () =>
    h("div", { className: "sk-stat" }, [h("span", { className: "sk-stat-labels" }, [line("22px", "sm"), line("34%", "sm"), line("22px", "sm")]), block("sk-bar")])
  )));
}

// Lineups: team bar, pitch, team bar.
export function SkeletonLineup() {
  return decorative(h("div", { className: "card sk-lineup" }, [
    h("div", { className: "sk-lineup-bar" }, [block("sk-avatar sm"), line("36%"), line("18%", "sm")]),
    block("sk-pitch"),
    h("div", { className: "sk-lineup-bar" }, [block("sk-avatar sm"), line("36%"), line("18%", "sm")]),
  ]));
}

// Match scoreboard: two crests around the score.
export function SkeletonMatchHero() {
  return decorative(h("div", { className: "sk-match-hero" }, [
    line("38%", "sm"),
    h("div", { className: "sk-scoreboard" }, [
      h("span", { className: "sk-side" }, [block("sk-crest"), line("70%")]),
      block("sk-score"),
      h("span", { className: "sk-side" }, [block("sk-crest"), line("70%")]),
    ]),
  ]));
}

// "Season  2025/26" bar while the season list loads.
export function SkeletonSeasonBar() {
  return decorative(h("div", { className: "season-bar sk-season" }, [line("64px"), line("74px")]));
}

// Crest grid (clubs of a league).
export function SkeletonClubGrid({ count = 6 } = {}) {
  return decorative(h("div", { className: "sk-clubs" }, Array.from({ length: count }, () =>
    h("div", { className: "card sk-club" }, [block("sk-avatar"), line("70%", "sm")])
  )));
}

// Whole-screen fallback (lazy screens): nav bar, title, a card and a list.
export function SkeletonPage() {
  return decorative(h("div", { className: "sk-page" }, [
    h("div", { className: "sk-nav" }, [line("54px"), line("84px", "lg"), h("span")]),
    h("div", { className: "sk-page-body" }, [line("46%", "xl"), SkeletonCards({ count: 1 }), SkeletonList({ rows: 3 })]),
  ]));
}

// ---------------------------------------------------------------------------
// 3. Lookup by name
// ---------------------------------------------------------------------------
const PRESETS = {
  list: () => SkeletonList({ rows: 5 }),
  rows: () => SkeletonList({ rows: 2 }),
  row: () => SkeletonList({ rows: 1 }),
  people: () => SkeletonList({ rows: 5, avatar: "round" }),
  peopleFew: () => SkeletonList({ rows: 3, avatar: "round" }),
  person: () => SkeletonList({ rows: 1, avatar: "round" }),
  clubs: () => SkeletonClubGrid({ count: 6 }),
  card: () => SkeletonCards({ count: 1 }),
  cards: () => SkeletonCards({ count: 3 }),
  summary: () => SkeletonCards({ count: 2 }),
  tiles: () => SkeletonTiles({ count: 4 }),
  hero: () => SkeletonHero(),
  matches: () => SkeletonMatchList({ leagues: 2, rows: 3 }),
  table: () => SkeletonTable({ rows: 8 }),
  stats: () => SkeletonStats({ rows: 6 }),
  pitch: () => SkeletonLineup(),
  overview: () => h("div", { className: "sk-stack", "aria-hidden": "true" }, [SkeletonHero(), SkeletonTiles({ count: 4 }), SkeletonList({ rows: 2 })]),
  playerOverview: () => h("div", { className: "sk-stack", "aria-hidden": "true" }, [SkeletonHero({ shape: "round" }), SkeletonList({ rows: 1 }), SkeletonTiles({ count: 5 })]),
};

export function skeletonFor(kind = "list") {
  const make = PRESETS[kind] || PRESETS.list;
  return make();
}
