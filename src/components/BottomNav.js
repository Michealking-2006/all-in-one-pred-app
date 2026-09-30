import { h, text } from "../utils/h.js";

const TABS = [
  { id: "home", label: "Games", icon: "layout-grid" },
  { id: "vip", label: "VIP", icon: "sparkles" },
  { id: "leagues", label: "Leagues", icon: "trophy" },
  { id: "profile", label: "Profile", icon: "user-round" },
];

export function BottomNav({ active, onChange }) {
  return h("nav", { className: "bottom-nav", "aria-label": "Primary navigation" },
    TABS.map(({ id, label, icon }) => {
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
    })
  );
}
