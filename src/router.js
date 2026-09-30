import { store } from "./store.js";

const VALID_TABS = new Set([
  "home","vip","leagues","profile","auth","favorites","edit-profile","change-password",
  "news","notifications","help-centre","report-issue","contact-us","privacy-policy",
  "terms-of-use","about","language","appearance","premium","coins","avatar","search"
]);

const AUTH_MODES = ["signup", "reset", "login", "update"];

function syncFromPath() {
  const url = new URL(window.location.href);
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const current = store.getState();
  const modal = url.searchParams.get("modal");

  if (parts[0] === "auth") {
    const mode = AUTH_MODES.includes(parts[1]) ? parts[1] : "login";
    store.setState({ tab: "auth", authMode: mode, openFixtureId: null, openEntity: null, modal });
    return;
  }

  if (parts[0] === "match" && parts[1]) {
    const id = parseInt(parts[1], 10);
    if (Number.isInteger(id) && id > 0) {
      store.setState({ openFixtureId: id, openEntity: null, matchTab: id === current.openFixtureId ? current.matchTab : "summary", modal });
      return;
    }
  }

  if (["league", "club", "venue", "player"].includes(parts[0]) && parts[1]) {
    const id = parseInt(parts[1], 10);
    if (Number.isInteger(id) && id > 0) {
      store.setState({ openEntity: { type: parts[0], id }, openFixtureId: null, modal });
      return;
    }
  }

  // A single unknown path segment is treated as a league slug (legacy links).
  // Anything that looks like a file name is not.
  if (parts.length === 1 && !VALID_TABS.has(parts[0]) && /^[a-z0-9-]+$/i.test(parts[0])) {
    store.setState({ tab: "home", openEntity: { type: "league-slug", slug: parts[0] }, openFixtureId: null, modal });
    return;
  }

  store.setState({
    tab: VALID_TABS.has(parts[0]) ? parts[0] : "home",
    openFixtureId: null,
    openEntity: null,
    modal,
  });
}

// Every in-app navigation is tagged so goBack() knows whether history.back()
// stays inside the app.
export function navigate(path, { replace = false } = {}) {
  const normalized = path.startsWith("/") ? path : "/" + path;
  const url = new URL(normalized, window.location.origin);
  const next = url.pathname + url.search;
  if (replace) {
    window.history.replaceState(window.history.state, "", next);
  } else if (window.location.pathname + window.location.search !== next) {
    window.history.pushState({ sw: 1 }, "", next);
  }
  syncFromPath();
}

// Back button behaviour: step back if the previous entry is inside the app,
// otherwise (deep link / fresh tab) go to a sensible fallback instead of
// leaving Scoutwave.
export function goBack(fallback = "/") {
  if (window.history.state && window.history.state.sw) window.history.back();
  else navigate(fallback, { replace: true });
}

export function openModal(name) {
  const url = new URL(window.location.href);
  url.searchParams.set("modal", name);
  window.history.pushState({ sw: 1 }, "", url.pathname + url.search);
  syncFromPath();
}

export function closeModal() {
  const url = new URL(window.location.href);
  url.searchParams.delete("modal");
  window.history.pushState({ sw: 1 }, "", url.pathname + url.search);
  syncFromPath();
}

export function initRouter() {
  window.addEventListener("popstate", syncFromPath);
  syncFromPath();
}
