import { h, text } from "../utils/h.js";
import { matches } from "../data/mockData.js";

// props: { favoriteMatchIds, onToggleFavorite, onOpenMatch, onBack }
export function FavoritesScreen({ favoriteMatchIds, onToggleFavorite, onOpenMatch, onBack }) {
  const favorited = matches.filter((m) => favoriteMatchIds.includes(m.id));

  return h("div", { className: "screen" }, [
    h("div", { style: { padding: "14px 18px", display: "flex", alignItems: "center", gap: "10px" } }, [
      h(
        "button",
        { "aria-label": "Back", onClick: onBack, style: { border: "none", background: "none", color: "var(--text)", padding: "2px" } },
        [h("i", { "data-lucide": "arrow-left", "aria-hidden": "true", style: { width: "18px", height: "18px" } })]
      ),
      text("span", { style: { fontWeight: "700", fontSize: "16px" } }, "My favourites"),
    ]),
    favorited.length === 0
      ? text("div", { style: { padding: "40px 18px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" } }, "No favourites yet — tap the star on any match to add it here.")
      : h(
          "div",
          {},
          favorited.map((m) =>
            h("div", { style: { padding: "12px 18px", borderBottom: "0.5px solid var(--border-soft)", display: "flex", alignItems: "center", gap: "10px" } }, [
              h(
                "div",
                { role: "button", tabindex: "0", onClick: () => onOpenMatch(m.id), style: { flex: "1" } },
                [
                  text("div", { className: "mono eyebrow", style: { marginBottom: "6px" } }, `${m.league} \u00b7 ${m.time}`),
                  h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
                    h("div", { style: { fontSize: "14px", fontWeight: "500", lineHeight: "1.5" } }, [text("span", {}, m.home), h("br"), text("span", {}, m.away)]),
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
                  "aria-label": "Remove from favorites",
                  onClick: (e) => {
                    e.stopPropagation();
                    onToggleFavorite(m.id);
                  },
                  style: { border: "none", background: "none", padding: "4px", color: "var(--accent)" },
                },
                [h("i", { "data-lucide": "star", "aria-hidden": "true", style: { width: "18px", height: "18px" }, fill: "currentColor" })]
              ),
            ])
          )
        ),
  ]);
}
