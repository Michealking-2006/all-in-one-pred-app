import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { CLUBS, isHex } from "../clubTheme.js";

const OPTIONS = [
  { id: "system", icon: "smartphone", title: "System", subtitle: "Matches your device setting" },
  { id: "light", icon: "sun", title: "Light", subtitle: "Always use the light theme" },
  { id: "dark", icon: "moon", title: "Dark", subtitle: "Always use the dark theme" },
];

function swatch(club) {
  const secondary = club.secondary && club.secondary.toLowerCase() !== "#ffffff" ? club.secondary : null;
  return h("span", { className: "club-swatch", "aria-hidden": "true", style: { background: secondary ? `linear-gradient(135deg, ${club.primary} 50%, ${secondary} 50%)` : club.primary } });
}

export function AppearanceScreen({ current, club, onSelect, onSelectClub, onBack }) {
  const activeId = club?.id || null;
  const customValue = club?.id === "custom" && isHex(club.primary) ? club.primary : "#d50000";

  const custom = h("input", { type: "color", className: "club-color-input", value: customValue, "aria-label": "Pick your own colour" });
  // `change` (not `input`): applying a theme re-renders the app, which would close the picker mid-drag.
  custom.addEventListener("change", () => onSelectClub({ id: "custom", name: "Custom", primary: custom.value }));

  return h("main", { className: "screen language-screen" }, [
    PageHeader({ title: "Appearance", onBack }),
    h("section", { className: "selection-list card" }, OPTIONS.map((opt) =>
      h("button", { type: "button", className: "selection-row appearance-row", onClick: () => onSelect(opt.id) }, [
        h("i", { "data-lucide": opt.icon }),
        h("span", { className: "appearance-copy" }, [text("span", {}, opt.title), text("small", {}, opt.subtitle)]),
        opt.id === current ? h("i", { "data-lucide": "check" }) : null,
      ])
    )),
    text("p", { className: "screen-note" }, "System follows your phone's Light/Dark setting and switches automatically."),

    text("div", { className: "profile-section-label" }, "Club colours"),
    h("section", { className: "card club-preview" }, [
      text("p", {}, "Support your club? The app's colours follow it: buttons, tabs, links and live scores."),
      h("div", { className: "club-preview-row" }, [
        h("span", { className: "club-preview-button" }, "Follow"),
        h("span", { className: "club-preview-chip" }, [h("span", { className: "live-dot" }), text("span", {}, "Live 67'")]),
        text("span", { className: "club-preview-link" }, "See all"),
      ]),
    ]),
    h("section", { className: "selection-list card" }, [
      h("button", { type: "button", className: "selection-row appearance-row", onClick: () => onSelectClub(null) }, [
        h("i", { "data-lucide": "circle-dashed" }),
        h("span", { className: "appearance-copy" }, [text("span", {}, "Scoutwave red"), text("small", {}, "The standard colours")]),
        !activeId ? h("i", { "data-lucide": "check" }) : null,
      ]),
      h("label", { className: "selection-row appearance-row club-custom-row" }, [
        h("i", { "data-lucide": "palette" }),
        h("span", { className: "appearance-copy" }, [text("span", {}, "Your own colour"), text("small", {}, "Pick any colour for a club that isn't listed")]),
        activeId === "custom" ? h("i", { "data-lucide": "check" }) : custom,
        activeId === "custom" ? custom : null,
      ]),
    ]),
    h("div", { className: "club-grid-themes", role: "list" }, CLUBS.map((c) =>
      h("button", { type: "button", role: "listitem", className: "club-chip" + (c.id === activeId ? " selected" : ""), "aria-pressed": String(c.id === activeId), onClick: () => onSelectClub(c) }, [
        swatch(c),
        text("span", { className: "club-chip-name" }, c.name),
        c.id === activeId ? h("i", { "data-lucide": "check" }) : null,
      ])
    )),
  ]);
}
