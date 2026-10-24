import { h, text } from "../utils/h.js";
import { attachNavFx, currentFxTheme } from "../themeFxData.js";

const TABS = [
  { id: "home", label: "Games", icon: "games" },
  { id: "vip", label: "VIP", icon: "sparkles" },
  { id: "leagues", label: "Leagues", icon: "trophy" },
  { id: "news", label: "News", icon: "newspaper" },
  { id: "profile", label: "Profile", icon: "user-round" },
];

// The nav is rebuilt on every render, so the "glass lens" under the active tab
// remembers where it was and slides from there (only visible with an advanced theme).
let lastIndex = null;

export function BottomNav({ active, onChange }) {
  const index = Math.max(0, TABS.findIndex((tab) => tab.id === active));
  const from = lastIndex ?? index;
  lastIndex = index;

  const lens = h("span", { className: "nav-lens", "aria-hidden": "true" });
  lens.style.setProperty("--i", String(from));
  const layer = h("span", { className: "nav-fx", "aria-hidden": "true" });

  const nav = h("nav", { className: "bottom-nav", "aria-label": "Primary navigation" }, [
    lens,
    layer,
    ...TABS.map(({ id, label, icon }) => {
      const selected = active === id;
      return h("button", {
        className: `bottom-nav-item${selected ? " active" : ""}`,
        "aria-label": label,
        "aria-current": selected ? "page" : null,
        onClick: () => onChange(id),
      }, [
        h("i", { "data-lucide": icon, "aria-hidden": "true" }),
        text("span", {}, label),
      ]);
    }),
  ]);

  nav.style.setProperty("--tabs", String(TABS.length)); // custom properties need setProperty, not style assignment

  if (from !== index) {
    requestAnimationFrame(() => {
      lens.classList.add("moving");
      lens.style.setProperty("--i", String(index));
      setTimeout(() => lens.classList.remove("moving"), 650);
    });
  }
  attachNavFx(nav, layer, currentFxTheme);
  return nav;
}
