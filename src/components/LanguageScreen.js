import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { languages } from "../data/mockData.js";

// props: { current, onSelect, onBack }
export function LanguageScreen({ current, onSelect, onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Language", onBack }),
    ...languages.map((lang) =>
      h(
        "div",
        {
          role: "button",
          tabindex: "0",
          onClick: () => onSelect(lang),
          style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "0.5px solid var(--border-soft)" },
        },
        [
          text("span", { style: { fontSize: "14px" } }, lang),
          lang === current ? h("i", { "data-lucide": "check", "aria-hidden": "true", style: { width: "18px", height: "18px", color: "var(--accent)" } }) : null,
        ]
      )
    ),
  ]);
}
