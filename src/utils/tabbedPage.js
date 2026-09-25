import { h, text } from "./h.js";
import { PageHeader } from "../components/PageHeader.js";
import { skeletonFor } from "../components/Skeleton.js";

// Generic loading placeholder. Prefer skeletonFor("table" | "cards" | ...) so the
// placeholder matches the layout that replaces it.
export function skeletonBlock(kind = "list") {
  return skeletonFor(kind);
}

export function errorNode(message = "Couldn't load \u2014 check your connection.") {
  return text("div", { className: "async-error-state" }, message);
}

export function emptyNode(message) {
  return text("div", { className: "async-empty-state" }, message);
}

// tabs: [{ id, label, load: () => Promise<Node>, skeleton?: "list" | "table" | "cards" | ... }]
// Data comes through the cached API client, so revisiting a tab is cheap while
// live data (30s TTL) still refreshes.
// Optional: `hero` (node shown under the header), `action` (node in the header),
// `logo` (show the Scoutwave wordmark in the bar instead of the title text),
// `onTabChange(tabId)` (fired on user tab switches, not on the initial tab).
export function createTabbedPage({ title, onBack, tabs, defaultTab, hero = null, action = null, onTabChange = null, logo = false }) {
  const startTab = tabs.some((t) => t.id === defaultTab) ? defaultTab : tabs[0].id;
  const container = h("main", { className: "screen detail-screen" });
  container.appendChild(PageHeader({ title, onBack, action, logo }));
  if (hero) container.appendChild(hero);

  const tabBar = h("nav", { className: "detail-tabs", role: "tablist", "aria-label": "Section navigation", "data-count": String(tabs.length) });
  const panel = h("section", { className: "detail-panel", role: "tabpanel" });
  container.appendChild(tabBar);
  container.appendChild(panel);

  let activeTab = startTab;

  function renderActive() {
    const tab = tabs.find((t) => t.id === activeTab);
    panel.innerHTML = "";
    panel.setAttribute("aria-busy", "true");
    panel.appendChild(skeletonBlock(tab.skeleton));
    let pending;
    try {
      pending = Promise.resolve(tab.load());
    } catch (err) {
      pending = Promise.reject(err);
    }
    pending
      .then((node) => {
        if (activeTab === tab.id) {
          panel.innerHTML = "";
          panel.removeAttribute("aria-busy");
          panel.appendChild(node);
        }
      })
      .catch((err) => {
        if (activeTab === tab.id) {
          panel.innerHTML = "";
          panel.removeAttribute("aria-busy");
          panel.appendChild(errorNode(err?.message));
        }
      });
  }

  function setActive(tabId, { notify = true } = {}) {
    activeTab = tabId;
    [...tabBar.children].forEach((btn, i) => {
      const isActive = tabs[i].id === tabId;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });
    if (notify && onTabChange) onTabChange(tabId);
    renderActive();
  }

  tabs.forEach((tab) => {
    tabBar.appendChild(
      h("button", { type: "button", role: "tab", onClick: () => setActive(tab.id), className: "detail-tab" }, tab.label)
    );
  });

  setActive(startTab, { notify: false });
  // Re-runs the active tab's loader (used after a season change).
  container.reload = () => renderActive();
  // Lets a page jump to one of its own tabs (e.g. "See full table").
  container.setTab = (tabId) => { if (tabs.some((t) => t.id === tabId)) { setActive(tabId); container.scrollIntoView?.({ block: "start" }); } };
  return container;
}
