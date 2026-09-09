import { h, text } from "../utils/h.js";
import { matches } from "../data/mockData.js";
import { DateStrip } from "./DateStrip.js";

// props: { onOpenMatch, favoriteMatchIds, onToggleFavorite, selectedDayOffset, onSelectDay, onOpenProfile }
export function HomeScreen(props) {
  return h("div", { className: "screen" }, [
    h("div", { style: { background: "var(--accent)" } }, [
      h("div", { style: { padding: "16px 18px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
        h(
          "button",
          { "aria-label": "Search", onClick: props.onOpenSearch, style: { border: "none", background: "none", color: "var(--on-accent)", padding: "4px" } },
          [h("i", { "data-lucide": "search", "aria-hidden": "true", style: { width: "20px", height: "20px" } })]
        ),
        h("img", {
          src: "/src/assets/scoutwave-logo-light-a.png",
          alt: "Scoutwave",
          style: { height: "22px", width: "auto", display: "block" },
        }),
        h(
          "button",
          { "aria-label": "Profile", onClick: props.onOpenProfile, style: { border: "none", background: "none", color: "var(--on-accent)", padding: "4px" } },
          [h("i", { "data-lucide": "circle-user", "aria-hidden": "true", style: { width: "22px", height: "22px" } })]
        ),
      ]),
      DateStrip({ selectedOffset: props.selectedDayOffset, onSelectDay: props.onSelectDay }),
    ]),
    ...matches.map((m) => {
      const isFav = props.favoriteMatchIds.includes(m.id);
      return h(
        "div",
        {
          style: { padding: "12px 18px", borderBottom: "0.5px solid var(--border-soft)", display: "flex", alignItems: "center", gap: "10px" },
        },
        [
          h(
            "div",
            {
              role: "button",
              tabindex: "0",
              onClick: () => props.onOpenMatch(m.id),
              style: { flex: "1" },
            },
            [
              text("div", { className: "mono eyebrow", style: { marginBottom: "6px" } }, `${m.league} \u00b7 ${m.time}`),
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
                h("div", { style: { fontSize: "14px", fontWeight: "500", lineHeight: "1.5" } }, [
                  text("span", {}, m.home),
                  h("br"),
                  text("span", {}, m.away),
                ]),
                h("div", { className: "mono", style: { fontSize: "20px", fontWeight: "600", textAlign: "right", lineHeight: "1.4" } }, [
                  text("span", {}, m.scoreH),
                  h("br"),
                  text("span", {}, m.scoreA),
                ]),
              ]),
            ]
          ),
          h(
            "button",
            {
              "aria-label": isFav ? `Remove ${m.home} vs ${m.away} from favorites` : `Add ${m.home} vs ${m.away} to favorites`,
              onClick: (e) => {
                e.stopPropagation();
                props.onToggleFavorite(m.id);
              },
              style: { border: "none", background: "none", padding: "4px", color: isFav ? "var(--accent)" : "var(--text-muted)" },
            },
            [
              h("i", {
                "data-lucide": "star",
                "aria-hidden": "true",
                style: { width: "18px", height: "18px" },
                fill: isFav ? "currentColor" : "none",
              }),
            ]
          ),
        ]
      );
    }),
  ]);
}
