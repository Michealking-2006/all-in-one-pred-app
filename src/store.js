const STORAGE_KEY = "scoutwave.app.state.v2";
const PERSISTED_KEYS = [
  "isVip", "coins", "unlockedMatchIds", "favoriteMatchIds",
  "selectedDayOffset", "language", "avatarId", "notificationPrefs", "darkTheme"
];

function readPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const safe = {};
    if (typeof parsed.isVip === "boolean") safe.isVip = parsed.isVip;
    if (Number.isFinite(parsed.coins)) safe.coins = Math.max(0, Math.floor(parsed.coins));
    for (const key of ["unlockedMatchIds", "favoriteMatchIds"]) {
      if (Array.isArray(parsed[key])) safe[key] = parsed[key].filter((id) => Number.isInteger(id) && id > 0);
    }
    if (Number.isInteger(parsed.selectedDayOffset)) safe.selectedDayOffset = Math.max(-7, Math.min(7, parsed.selectedDayOffset));
    if (typeof parsed.language === "string" && parsed.language.trim()) safe.language = parsed.language;
    if (typeof parsed.avatarId === "string" || parsed.avatarId === null) safe.avatarId = parsed.avatarId;
    if (typeof parsed.darkTheme === "boolean") safe.darkTheme = parsed.darkTheme;
    if (parsed.notificationPrefs && typeof parsed.notificationPrefs === "object") {
      safe.notificationPrefs = { ...parsed.notificationPrefs };
    }
    return safe;
  } catch {
    return {};
  }
}

function persist(state) {
  try {
    const snapshot = {};
    for (const key of PERSISTED_KEYS) snapshot[key] = state[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

function createStore(initialState) {
  let state = { ...initialState, ...readPersisted() };
  const listeners = new Set();

  return {
    getState: () => state,
    setState(partial) {
      const next = typeof partial === "function" ? partial(state) : partial;
      if (!next || typeof next !== "object") return;
      state = { ...state, ...next };
      persist(state);
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const store = createStore({
  tab: "home",\n  authUser: null,
  authMode: "login",
  openMatchId: null,
  matchTab: "summary",
  isVip: false,
  modal: null,
  coins: 8,
  unlockedMatchIds: [],
  favoriteMatchIds: [],
  selectedDayOffset: 0,
  darkTheme: false,
  language: "English",
  avatarId: null,
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
