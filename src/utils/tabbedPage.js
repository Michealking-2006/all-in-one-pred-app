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
// Each tab's `load` is only called the first time it's activated, and its
// result is cached, so switching back and forth never refetches. Multiple
// tabs can share the same underlying fetch by memoizing that promise
// themselves before passing separate `.then()` mappers as `load` (see
// PlayerPage.js, where Overview and Statistics both read one API call).
export function createTabbedPage({ title, onBack, tabs, defaultTab = tabs[0].id }) {
  const container = h("div", { className: "screen" });
  container.appendChild(PageHeader({ title, onBack }));

  const tabBar = h("div", { style: { display: "flex", overflowX: "auto", borderBottom: "0.5px solid var(--border)" } });
  const panel = h("div", { style: { padding: "20px 18px" } });
  container.appendChild(tabBar);
  container.appendChild(panel);

  let activeTab = defaultTab;
  const cache = {};

  function renderActive() {
    panel.innerHTML = "";
    if (cache[activeTab]) {
      panel.appendChild(cache[activeTab]);
      return;
    }
    panel.appendChild(skeletonBlock());
    const tab = tabs.find((t) => t.id === activeTab);
    tab.load()
      .then((node) => {
        cache[tab.id] = node;
        if (activeTab === tab.id) {
          panel.innerHTML = "";
          panel.appendChild(node);
          refreshIcons();
        }
      })
      .catch(() => {
        if (activeTab === tab.id) {
          panel.innerHTML = "";
          panel.appendChild(errorNode());
        }
      });
  }

  function setActive(tabId) {
    activeTab = tabId;
    [...tabBar.children].forEach((btn, i) => {
      const isActive = tabs[i].id === tabId;
      btn.style.color = isActive ? "var(--text)" : "var(--text-muted)";
      btn.style.borderBottomColor = isActive ? "var(--accent)" : "transparent";
    });
    renderActive();
  }

  tabs.forEach((tab) => {
    const btn = h(
      "button",
      {
        onClick: () => setActive(tab.id),
        style: { flex: "0 0 auto", whiteSpace: "nowrap", padding: "11px 16px", border: "none", background: "none", fontSize: "13px", fontWeight: "500", borderBottom: "2px solid transparent", color: "var(--text-muted)" },
      },
      tab.label
    );
    tabBar.appendChild(btn);
  });

  setActive(defaultTab);
  return container;
}
