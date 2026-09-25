const STORAGE_KEY = "scoutwave.app.state.v2";
const PERSISTED_KEYS = [
  "isVip", "coins", "unlockedMatchIds", "favorites",
  "selectedDayOffset", "language", "avatarId", "notificationPrefs", "theme"
];
const THEME_VALUES = new Set(["system", "light", "dark"]);

// Real fixture ids are large; ids below this were the old mock matches.
const MIN_REAL_FIXTURE_ID = 1000;

// Every favouritable kind of thing. Order here is the display order on the
// Favourites page.
export const FAVORITE_TYPES = ["match", "club", "player", "venue", "league"];

function emptyFavorites() {
  return Object.fromEntries(FAVORITE_TYPES.map((type) => [type, []]));
}

function sanitizeFavoriteList(type, list) {
  if (!Array.isArray(list)) return [];
  const minId = type === "match" ? MIN_REAL_FIXTURE_ID : 1;
  return [...new Set(list.filter((id) => Number.isInteger(id) && id >= minId))];
}

function readPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const safe = {};
    if (typeof parsed.isVip === "boolean") safe.isVip = parsed.isVip;
    if (Number.isFinite(parsed.coins)) safe.coins = Math.max(0, Math.floor(parsed.coins));
    if (Array.isArray(parsed.unlockedMatchIds)) {
      safe.unlockedMatchIds = parsed.unlockedMatchIds.filter((id) => Number.isInteger(id) && id >= MIN_REAL_FIXTURE_ID);
    }
    // Favourites used to be match-only, stored as a flat `favoriteMatchIds`
    // array. Migrate that into the new per-type shape so nobody's existing
    // favourites disappear on update; the new shape wins if both are present.
    if (parsed.favorites && typeof parsed.favorites === "object") {
      safe.favorites = emptyFavorites();
      for (const type of FAVORITE_TYPES) safe.favorites[type] = sanitizeFavoriteList(type, parsed.favorites[type]);
    } else if (Array.isArray(parsed.favoriteMatchIds)) {
      safe.favorites = emptyFavorites();
      safe.favorites.match = sanitizeFavoriteList("match", parsed.favoriteMatchIds);
    }
    if (Number.isInteger(parsed.selectedDayOffset)) safe.selectedDayOffset = Math.max(-3, Math.min(3, parsed.selectedDayOffset));
    if (typeof parsed.language === "string" && parsed.language.trim()) safe.language = parsed.language;
    if (THEME_VALUES.has(parsed.theme)) safe.theme = parsed.theme;
    if (typeof parsed.avatarId === "string" || parsed.avatarId === null) safe.avatarId = parsed.avatarId;
    if (parsed.notificationPrefs && typeof parsed.notificationPrefs === "object") {
      safe.notificationPrefs = { ...parsed.notificationPrefs };
    }
    return safe;
  } catch {
    return {};
  }
}

let lastSerialized = null;

function persist(state) {
  try {
    const snapshot = {};
    for (const key of PERSISTED_KEYS) snapshot[key] = state[key];
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

function same(a, b) {
  if (a === b) return true;
  if (a && b && typeof a === "object" && typeof b === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function createStore(initialState) {
  let state = { ...initialState, ...readPersisted() };
  const listeners = new Set();

  return {
    getState: () => state,
    // setState(partial | fn, { silent }) — skips everything when nothing
    // actually changed, so redundant calls no longer trigger a full re-render.
    // `silent: true` updates + persists but does not notify subscribers; used
    // where the caller updates its own DOM (favourite stars, match tab).
    setState(partial, { silent = false } = {}) {
      const next = typeof partial === "function" ? partial(state) : partial;
      if (!next || typeof next !== "object") return;
      if (Object.keys(next).every((key) => same(state[key], next[key]))) return;
      state = { ...state, ...next };
      persist(state);
      if (!silent) listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const store = createStore({
  tab: "home",
  authUser: null,
  authMode: "login",
  openFixtureId: null,
  matchTab: "summary",
  isVip: false,
  modal: null,
  coins: 8,
  unlockedMatchIds: [],
  favorites: emptyFavorites(),
  selectedDayOffset: 0,
  language: "English",
  avatarId: null,
  theme: "system",
  openEntity: null,
  notificationPrefs: {
    kickoff: true,
    goals: true,
    vipTips: true,
    favourites: true,
    priceDrops: false,
  },
});

export const UNLOCK_COST = 5;
