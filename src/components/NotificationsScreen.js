import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const PREF_LABELS = {
  kickoff: "Match kickoff",
  goals: "Goal alerts",
  vipTips: "New VIP tips",
  favourites: "Favourite team updates",
  priceDrops: "Odds price drops",
};

function toggleSwitch(isOn, onToggle) {
  return h(
    "button",
    {
      "aria-pressed": isOn,
      onClick: onToggle,
      style: { width: "44px", height: "26px", borderRadius: "13px", border: "none", background: isOn ? "var(--accent)" : "var(--border)", position: "relative", padding: "0", flexShrink: "0" },
    },
    [h("span", { style: { position: "absolute", top: "3px", left: isOn ? "21px" : "3px", width: "20px", height: "20px", borderRadius: "50%", background: "#FFFFFF" } })]
  );
}

// props: { prefs, onTogglePref, onBack }
export function NotificationsScreen({ prefs, onTogglePref, onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Notifications", onBack }),
    ...Object.keys(PREF_LABELS).map((key) =>
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "0.5px solid var(--border-soft)" } }, [
        text("span", { style: { fontSize: "14px" } }, PREF_LABELS[key]),
        toggleSwitch(prefs[key], () => onTogglePref(key)),
      ])
    ),
  ]);
}
