import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const OPTIONS = [
  { id: "system", icon: "smartphone", title: "System", subtitle: "Matches your device setting" },
  { id: "light", icon: "sun", title: "Light", subtitle: "Always use the light theme" },
  { id: "dark", icon: "moon", title: "Dark", subtitle: "Always use the dark theme" },
];

export function AppearanceScreen({ current, onSelect, onBack }) {
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
  ]);
}
