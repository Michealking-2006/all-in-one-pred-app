import { h, text } from "../utils/h.js";

const TABS = [
  { id: "home", label: "Games", icon: "volleyball" },
  { id: "vip", label: "VIP", icon: "target" },
  { id: "leagues", label: "Leagues", icon: "trophy" },
  { id: "profile", label: "Profile", icon: "user" },
];

// props: { active, onChange }
export function BottomNav(props) {
  return h(
    "nav",
    {
      style: {
        display: "flex",
        borderTop: "0.5px solid var(--border)",
        background: "var(--bg)",
        position: "sticky",
        bottom: "0",
      },
    },
    TABS.map(({ id, label, icon }) => {
      const isActive = props.active === id;
      return h(
        "button",
        {
          "aria-label": label,
          "aria-current": isActive ? "page" : null,
          onClick: () => props.onChange(id),
          style: {
            flex: "1",
            padding: "11px 0",
            border: "none",
            background: "none",
            textAlign: "center",
            color: isActive ? "var(--accent)" : "var(--text-muted)",
          },
        },
        [
          h("i", {
            "data-lucide": icon,
            "aria-hidden": "true",
            style: { display: "block", margin: "0 auto 3px", width: "19px", height: "19px" },
          }),
          text("span", { className: "mono", style: { fontSize: "10px" } }, label.toUpperCase()),
        ]
      );
    })
  );
}
