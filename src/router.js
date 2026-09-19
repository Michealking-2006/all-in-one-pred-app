import { store } from "./store.js";

const VALID_TABS = new Set([
  "home","vip","leagues","profile","favorites","edit-profile","change-password",
  "news","notifications","help-centre","report-issue","contact-us","privacy-policy",
  "terms-of-use","about","language","premium","coins","avatar","search"
]);
const ENTITY_ROUTES = new Set(["league","club","venue","player"]);

function syncFromPath() {
  const url = new URL(window.location.href);
  const raw = url.pathname.replace(/^\/+|\/+$/g, "");
  const [path, queryString] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const current = store.getState();
  const modal = new URLSearchParams(url.search || queryString || "").get("modal");

  if (parts[0] === "match" && parts[1]) {
    const matchId = Number(parts[1]);
    if (Number.isInteger(matchId) && matchId > 0) {
      store.setState({ openMatchId: matchId, openEntity: null, matchTab: matchId === current.openMatchId ? current.matchTab : "summary", modal });
      return;
    }
  }

  if (parts[0] === "league" && parts[1]) {
    const id = parseInt(parts[1], 10);
    if (Number.isInteger(id) && id > 0) {
      store.setState({ openEntity: { type: "league", id }, openMatchId: null, modal });
      return;
    }
  }

  if (parts[0] === "club" && parts[1]) {
    const id = parseInt(parts[1], 10);
    if (Number.isInteger(id) && id > 0) {
      store.setState({ openEntity: { type: "club", id }, openMatchId: null, modal });
      return;
    }
  }

  if (parts[0] === "venue" && parts[1]) {
    const id = parseInt(parts[1], 10);
    if (Number.isInteger(id) && id > 0) {
      store.setState({ openEntity: { type: "venue", id }, openMatchId: null, modal });
      return;
    }
  }

  if (parts[0] === "player" && parts[1]) {
    const id = parseInt(parts[1], 10);
    if (Number.isInteger(id) && id > 0) {
      store.setState({ openEntity: { type: "player", id }, openMatchId: null, modal });
      return;
    }
  }

  if (parts.length === 1 && parts[0] && !VALID_TABS.has(parts[0])) {
    store.setState({ openEntity: { type: "league-slug", slug: parts[0] }, openMatchId: null, modal });
    return;
  }

  const tab = VALID_TABS.has(parts[0]) ? parts[0] : "home";
  store.setState({ tab, openMatchId: null, openEntity: null, modal });
}

export function navigate(path) {
  const normalized = path.startsWith("/") ? path : "/" + path;
  const url = new URL(normalized, window.location.origin);
  const next = url.pathname + url.search;
  if (window.location.pathname + window.location.search !== next) window.history.pushState({}, "", next);
  syncFromPath();
}

export function openModal(name) {
  const base = window.location.hash.split("?")[0].replace(/^#/, "") || "/home";
  navigate(`${base}?modal=${encodeURIComponent(name)}`);
}

export function closeModal() {
  window.history.back();
}

export function initRouter() {
  window.addEventListener("popstate", syncFromPath);
  syncFromPath();
}
