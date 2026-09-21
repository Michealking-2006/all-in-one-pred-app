import { h, text } from "./h.js";
import { skeletonBlock, errorNode } from "./tabbedPage.js";

// A titled block used by the entity pages. `body` is where content goes.
export function sectionShell(title, { action = null, className = "" } = {}) {
  const body = h("div", { className: "info-section-body" });
  const head = title || action
    ? h("div", { className: "info-section-head" }, [title ? text("h2", { className: "info-section-title" }, title) : h("span"), action])
    : null;
  const root = h("section", { className: ("info-section " + className).trim() }, [head, body]);
  return { root, body };
}

// A section that loads on its own. `render(data)` returns a node, or null/undefined
// to hide the section (nothing to show). Optional sections hide quietly if their
// request fails, so one missing endpoint never breaks the rest of the page.
export function asyncSection({ title, load, render, action = null, onError = "hide", className = "" }) {
  const { root, body } = sectionShell(title, { action, className });
  body.appendChild(skeletonBlock());

  const show = (data) => {
    let node = null;
    try {
      node = render(data);
    } catch (error) {
      console.error("Section render error:", title, error);
    }
    if (!node) {
      root.hidden = true;
      return;
    }
    body.replaceChildren(node);
  };

  Promise.resolve()
    .then(load)
    .then(show)
    .catch((error) => {
      if (onError === "show") body.replaceChildren(errorNode(error?.message));
      else {
        console.warn("Section unavailable:", title, error?.message);
        root.hidden = true;
      }
    });

  return root;
}

// [[label, value], ...] -> grid of big-number tiles. Empty values are skipped.
export function statTiles(pairs) {
  const tiles = pairs
    .filter(([, value]) => value != null && value !== "")
    .map(([label, value]) =>
      h("div", { className: "stat-tile" }, [text("span", { className: "stat-tile-value mono" }, value), text("span", { className: "stat-tile-label" }, label)])
    );
  return tiles.length ? h("div", { className: "stat-tiles", "data-count": String(tiles.length) }, tiles) : null;
}

// [[label, value], ...] -> inset card of label/value rows. Empty values are skipped.
export function kvCard(pairs, className = "") {
  const rows = pairs
    .filter(([, value]) => value != null && value !== "" && value !== "null")
    .map(([label, value]) => h("div", { className: "kv-row" }, [text("span", {}, label), text("strong", {}, value)]));
  return rows.length ? h("div", { className: ("card kv-card " + className).trim() }, rows) : null;
}

// "WWDLW" -> coloured chips (most recent last)
export function formChips(form, max = 5) {
  const letters = String(form || "").toUpperCase().replace(/[^WDL]/g, "").slice(-max).split("");
  if (!letters.length) return null;
  return h("div", { className: "form-chips", role: "img", "aria-label": "Recent form: " + letters.join(" ") },
    letters.map((l) => resultBadge(l)));
}

export function resultBadge(letter) {
  const kind = letter === "W" ? "win" : letter === "L" ? "loss" : "draw";
  return h("span", { className: "form-chip " + kind }, letter);
}
