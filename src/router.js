import { store } from "./store.js";

const VALID_TABS = new Set([
  "home","vip","leagues","profile","favorites","edit-profile","change-password",
  "news","notifications","help-centre","report-issue","contact-us","privacy-policy",
  "terms-of-use","about","language","premium","coins","avatar","search"
]);
const ENTITY_ROUTES = new Set(["league","club","venue","player"]);

function syncFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const current = store.getState();
  const modal = query ? new URLSearchParams(query).get("modal") : null;

  if (parts[0] === "match" && parts[1]) {
    const matchId = Number(parts[1]);
    if (Number.isInteger(matchId) && matchId > 0) {
      store.setState({
        openMatchId: matchId,
        openEntity: null,
        matchTab: matchId === current.openMatchId ? current.matchTab : "summary",
        modal,
      });
      return;
    }
  }

  if (ENTITY_ROUTES.has(parts[0]) && parts[1]) {
    const id = parseInt(parts[1], 10);
    if (Number.isInteger(id) && id > 0) {
      store.setState({
        openEntity: { type: parts[0], id },
        openMatchId: null,
        modal,
      });
      return;
    }
  }

  const tab = VALID_TABS.has(parts[0]) ? parts[0] : "home";
  store.setState({ tab, openMatchId: null, openEntity: null, modal });
}

export function navigate(path) {
  const normalized = path.startsWith("/") ? path : "/" + path;
  const next = "#" + normalized;
  if (window.location.hash !== next) window.location.hash = next;
}

export function openModal(name) {
  const base = window.location.hash.split("?")[0].replace(/^#/, "") || "/home";
  navigate(`${base}?modal=${encodeURIComponent(name)}`);
}

export function closeModal() {
  window.history.back();
}

export function initRouter() {
  window.addEventListener("hashchange", syncFromHash);
  if (!window.location.hash || window.location.hash === "#") navigate("/home");
  else syncFromHash();
}
