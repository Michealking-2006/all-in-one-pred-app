import { store } from "./store.js";

const VALID_TABS = new Set([
  "home","vip","leagues","profile","auth","favorites","edit-profile","change-password",
  "news","notifications","help-centre","report-issue","contact-us","privacy-policy",
  "terms-of-use","about","language","premium","coins","avatar","search"
]);

function syncFromPath() {
  const url = new URL(window.location.href);
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const current = store.getState();
  const modal = url.searchParams.get("modal");

  if (parts[0] === "match" && parts[1]) {
    const id = Number(parts[1]);
    if (Number.isInteger(id) && id > 0) {
      store.setState({ openMatchId: id, openEntity: null, matchTab: id === current.openMatchId ? current.matchTab : "summary", modal });
      return;
    }
  }

  if (["league","club","venue","player"].includes(parts[0]) && parts[1]) {
    const id = parseInt(parts[1], 10);
    if (Number.isInteger(id) && id > 0) {
      store.setState({ openEntity: { type: parts[0], id }, openMatchId: null, modal });
      return;
    }
  }

  if (parts.length === 1 && parts[0] && !VALID_TABS.has(parts[0])) {
    store.setState({ openEntity: { type: "league-slug", slug: parts[0] }, openMatchId: null, modal });
    return;
  }

  store.setState({
    tab: VALID_TABS.has(parts[0]) ? parts[0] : "home",
    openMatchId: null,
    openEntity: null,
    modal,
  });
}

export function navigate(path) {
  const normalized = path.startsWith("/") ? path : "/" + path;
  const url = new URL(normalized, window.location.origin);
  const next = url.pathname + url.search;
  if (window.location.pathname + window.location.search !== next) window.history.pushState({}, "", next);
  syncFromPath();
}

export function openModal(name) {
  const url = new URL(window.location.href);
  url.searchParams.set("modal", name);
  const next = url.pathname + url.search;
  window.history.pushState({}, "", next);
  syncFromPath();
}

export function closeModal() {
  const url = new URL(window.location.href);
  url.searchParams.delete("modal");
  window.history.pushState({}, "", url.pathname + url.search);
  syncFromPath();
}

export function initRouter() {
  window.addEventListener("popstate", syncFromPath);
  syncFromPath();
}
