// Minimal store: getState/setState/subscribe. Any setState triggers every
// subscriber (App's render function subscribes once at boot), the same
// mental model as React re-rendering on state change — just manual.
function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,
    setState(partial) {
      state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
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
  modal: null, // e.g. "paywall" — any future sheet/popup sets its own name here
  coins: 8,
  unlockedMatchIds: [], // match ids paid for one-off with coins, independent of VIP status
  favoriteMatchIds: [],
  selectedDayOffset: 0, // days from today, shown in the date strip
  darkTheme: false,
  language: "English",
  avatarId: null,
  openEntity: null, // { type: "league" | "club" | "venue" | "player", id }
  notificationPrefs: {
    kickoff: true,
    goals: true,
    vipTips: true,
    favourites: true,
    priceDrops: false,
  },
});

export const UNLOCK_COST = 5;
