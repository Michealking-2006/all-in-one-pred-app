import { h, text } from "./h.js";
import { PageHeader } from "../components/PageHeader.js";
import { Skeleton } from "../components/Skeleton.js";

export function skeletonBlock() {
  return h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, [
    Skeleton({ style: { width: "100%", height: "40px", borderRadius: "8px" } }),
    Skeleton({ style: { width: "100%", height: "40px", borderRadius: "8px" } }),
    Skeleton({ style: { width: "100%", height: "40px", borderRadius: "8px" } }),
  ]);
}

export function errorNode(message = "Couldn't load \u2014 check your connection.") {
  return text("div", { className: "async-error-state" }, message);
}

export function emptyNode(message) {
  return text("div", { className: "async-empty-state" }, message);
}

// tabs: [{ id, label, load: () => Promise<Node> }]
// Data comes through the cached API client, so revisiting a tab is cheap while
// live data (30s TTL) still refreshes.
// Optional: `hero` (node shown under the header), `action` (node in the header),
// `onTabChange(tabId)` (fired on user tab switches, not on the initial tab).
export function createTabbedPage({ title, onBack, tabs, defaultTab, hero = null, action = null, onTabChange = null }) {
  const startTab = tabs.some((t) => t.id === defaultTab) ? defaultTab : tabs[0].id;
  const container = h("main", { className: "screen detail-screen" });
  container.appendChild(PageHeader({ title, onBack, action }));
  if (hero) container.appendChild(hero);

  const tabBar = h("nav", { className: "detail-tabs", role: "tablist", "aria-label": "Section navigation", "data-count": String(tabs.length) });
  const panel = h("section", { className: "detail-panel", role: "tabpanel" });
  container.appendChild(tabBar);
  container.appendChild(panel);

  let activeTab = startTab;

  function renderActive() {
    panel.innerHTML = "";
    panel.appendChild(skeletonBlock());
    const tab = tabs.find((t) => t.id === activeTab);
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
          panel.appendChild(node);
        }
      })
      .catch((err) => {
        if (activeTab === tab.id) {
          panel.innerHTML = "";
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
