import { store } from "./store.js";

const VALID_TABS = [
  "home", "vip", "leagues", "profile", "favorites",
  "edit-profile", "change-password", "news", "notifications",
  "help-centre", "report-issue", "contact-us", "privacy-policy",
  "terms-of-use", "about", "language", "premium", "coins", "avatar", "search",
];

// A modal/sheet/popup is layered on top of a page route as "?modal=name",
// e.g. "#/vip?modal=paywall" or "#/match/2?modal=paywall". This means any
// screen can open the same modal without the router needing to know about
// every page it might appear on, and the base page route stays intact
// underneath — closing the modal just reveals it again.
function syncFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const current = store.getState();

  const modal = query ? new URLSearchParams(query).get("modal") : null;

  if (parts[0] === "match" && parts[1]) {
    const matchId = Number(parts[1]);
    store.setState({
      openMatchId: matchId,
      openEntity: null,
      matchTab: matchId === current.openMatchId ? current.matchTab : "summary",
      modal,
    });
    return;
  }

  // Slug is "id-readable-name" (see src/utils/slug.js) — parseInt happily
  // stops at the first non-digit character, so this works without a split.
  const ENTITY_ROUTES = new Set(["league", "club", "venue", "player"]);
  if (ENTITY_ROUTES.has(parts[0]) && parts[1]) {
    store.setState({ openEntity: { type: parts[0], id: parseInt(parts[1], 10) }, openMatchId: null, modal });
    return;
  }

  const tab = VALID_TABS.includes(parts[0]) ? parts[0] : "home";
  store.setState({ tab, openMatchId: null, openEntity: null, modal });
}

// Pushes a new hash — a real history entry, so the browser/hardware back
// button naturally steps back through it. Call this instead of touching
// location.hash directly or calling store.setState for route fields.
export function navigate(path) {
  window.location.hash = path;
}

// Opens a modal/sheet/popup on top of whatever page is currently active,
// without disturbing that page's own route.
export function openModal(name) {
  const base = window.location.hash.split("?")[0].replace(/^#/, "") || "/home";
  navigate(`${base}?modal=${name}`);
}

// Dismissing a modal is just "go back" — same mental model as closing a
// match screen. Works for the explicit close button AND the back gesture.
export function closeModal() {
  window.history.back();
}

export function initRouter() {
  window.addEventListener("hashchange", syncFromHash);
  if (!window.location.hash || window.location.hash === "#") {
    navigate("/home");
  }
  syncFromHash();
}
