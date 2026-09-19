const STORAGE_KEY = "scoutwave.app.state.v2";
const PERSISTED_KEYS = [
  "isVip", "coins", "unlockedMatchIds", "favoriteMatchIds",
  "selectedDayOffset", "language", "avatarId", "notificationPrefs"
];

function readPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
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
  tab: "home",
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
