import { h, text } from "./h.js";
import { PageHeader } from "../components/PageHeader.js";
import { Skeleton } from "../components/Skeleton.js";

function refreshIcons() {
  // Icons render synchronously as inline SVG now (see utils/icons.js), so
  // there's nothing to do here — kept as a named no-op so call sites below
  // don't need to change if that ever stops being true.
}

export function skeletonBlock() {
  return h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, [
    Skeleton({ style: { width: "100%", height: "40px", borderRadius: "8px" } }),
    Skeleton({ style: { width: "100%", height: "40px", borderRadius: "8px" } }),
    Skeleton({ style: { width: "100%", height: "40px", borderRadius: "8px" } }),
  ]);
}

export function errorNode(message = "Couldn't load \u2014 check your connection.") {
  return text("div", { style: { textAlign: "center", color: "var(--danger)", fontSize: "13px", padding: "30px 0" } }, message);
}

export function emptyNode(message) {
  return text("div", { style: { textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "30px 0" } }, message);
}

// tabs: [{ id, label, load: () => Promise<Node> }]
// Each activation loads fresh data. This app intentionally does not cache
// page/tab responses, so live football information can refresh when revisited.
export function createTabbedPage({ title, onBack, tabs, defaultTab = tabs[0].id }) {
  const container = h("main", { className: "screen detail-screen" });
  container.appendChild(PageHeader({ title, onBack }));

  const tabBar = h("nav", { className: "detail-tabs", "aria-label": "Section navigation" });
  const panel = h("section", { className: "detail-panel" });
  container.appendChild(tabBar);
  container.appendChild(panel);

  let activeTab = defaultTab;


  function renderActive() {
    panel.innerHTML = "";
    panel.appendChild(skeletonBlock());
    const tab = tabs.find((t) => t.id === activeTab);
    tab.load()
      .then((node) => {
        if (activeTab === tab.id) {
          panel.innerHTML = "";
          panel.appendChild(node);
          refreshIcons();
        }
      })
      .catch((err) => {
        if (activeTab === tab.id) {
          panel.innerHTML = "";
          panel.appendChild(errorNode(err.message));
        }
      });
  }

  function setActive(tabId) {
    activeTab = tabId;
    [...tabBar.children].forEach((btn, i) => {
      const isActive = tabs[i].id === tabId;
      btn.classList.toggle("active", isActive);
    });
    renderActive();
  }

  tabs.forEach((tab) => {
    const btn = h(
      "button",
      {
        onClick: () => setActive(tab.id),
        className: "detail-tab",
      },
      tab.label
    );
    tabBar.appendChild(btn);
  });

  setActive(defaultTab);
  return container;
}
