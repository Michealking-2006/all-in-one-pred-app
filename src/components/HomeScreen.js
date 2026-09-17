import { h, text } from "../utils/h.js";
import { matches, trackRecord } from "../data/mockData.js";
import { DateStrip } from "./DateStrip.js";

function groupByLeague(list) {
  const groups = [];
  list.forEach((m) => {
    let group = groups.find((g) => g.league === m.league);
    if (!group) {
      group = { league: m.league, items: [] };
      groups.push(group);
    }
    group.items.push(m);
  });
  return groups;
}

function matchRow(m, isFav, props) {
  const isLive = m.status === "live";
  return h("div", { style: { display: "flex", alignItems: "center", gap: "12px", padding: "13px 0" } }, [
    h("div", { style: { flexShrink: "0", width: "40px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" } }, [
      isLive
        ? h("span", { className: "live-dot", style: { width: "7px", height: "7px", borderRadius: "50%", background: "var(--accent)", display: "block" } })
        : null,
      text("div", { style: { fontSize: "11px", color: isLive ? "var(--accent)" : "var(--text-muted)", fontWeight: isLive ? "700" : "400" } }, m.time),
    ]),
    h(
      "div",
      { role: "button", tabindex: "0", onClick: () => props.onOpenMatch(m.id), style: { flex: "1", display: "flex", flexDirection: "column", gap: "4px" } },
      [
        text("div", { style: { fontSize: "14px" } }, m.home),
        text("div", { style: { fontSize: "14px" } }, m.away),
      ]
    ),
    h("div", { className: "mono", style: { fontSize: "18px", fontWeight: "600", textAlign: "right", lineHeight: "1.4", flexShrink: "0" } }, [
      text("span", {}, m.scoreH),
      h("br"),
      text("span", {}, m.scoreA),
    ]),
    h(
      "button",
      {
        "aria-label": isFav ? `Remove ${m.home} vs ${m.away} from favorites` : `Add ${m.home} vs ${m.away} to favorites`,
        onClick: (e) => {
          e.stopPropagation();
          props.onToggleFavorite(m.id);
        },
        style: { border: "none", background: "none", padding: "4px", flexShrink: "0", color: isFav ? "var(--accent)" : "var(--text-muted)" },
      },
      [h("i", { "data-lucide": "star", "aria-hidden": "true", style: { width: "17px", height: "17px" }, fill: isFav ? "currentColor" : "none" })]
    ),
  ]);
}

function featuredTipBanner(props) {
  const topPick = [...matches].sort((a, b) => b.confidence - a.confidence)[0];
  return h(
    "div",
    {
      role: "button",
      tabindex: "0",
      onClick: props.onOpenVip,
      className: "shadow-md",
      style: {
        margin: "18px 18px 0",
        borderRadius: "14px",
        background: "var(--text)",
        color: "var(--bg)",
        padding: "16px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
      },
    },
    [
      h("i", { "data-lucide": "gem", "aria-hidden": "true", style: { width: "26px", height: "26px", color: "var(--accent)", flexShrink: "0" } }),
      h("div", { style: { flex: "1", minWidth: "0" } }, [
        text("div", { style: { fontSize: "11px", opacity: "0.65", marginBottom: "3px" } }, `Today's top pick \u2014 ${trackRecord.overall}% hit rate last 30 tips`),
        text("div", { style: { fontSize: "14px", fontWeight: "700" } }, `${topPick.home} vs ${topPick.away}`),
      ]),
      h("i", { "data-lucide": "chevron-right", "aria-hidden": "true", style: { width: "18px", height: "18px", opacity: "0.6", flexShrink: "0" } }),
    ]
  );
}

// props: { onOpenMatch, favoriteMatchIds, onToggleFavorite, selectedDayOffset, onSelectDay, onOpenProfile, onOpenSearch, onOpenVip }
export function HomeScreen(props) {
  const groups = groupByLeague(matches);

  return h("div", { className: "screen" }, [
    h("div", { style: { background: "var(--accent)" } }, [
      h("div", { style: { padding: "16px 18px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
        h(
          "button",
          { "aria-label": "Search", onClick: props.onOpenSearch, style: { border: "none", background: "none", color: "var(--on-accent)", padding: "4px" } },
          [h("i", { "data-lucide": "search", "aria-hidden": "true", style: { width: "20px", height: "20px" } })]
        ),
        h("img", { src: "/src/assets/scoutwave-logo-light-a.png", alt: "Scoutwave", style: { height: "22px", width: "auto", display: "block" } }),
        h(
          "button",
          { "aria-label": "Profile", onClick: props.onOpenProfile, style: { border: "none", background: "none", color: "var(--on-accent)", padding: "4px" } },
          [h("i", { "data-lucide": "circle-user", "aria-hidden": "true", style: { width: "22px", height: "22px" } })]
        ),
      ]),
      DateStrip({ selectedOffset: props.selectedDayOffset, onSelectDay: props.onSelectDay }),
    ]),
    featuredTipBanner(props),
    h(
      "div",
      { style: { padding: "18px" } },
      groups.map((group, i) =>
        h("div", { style: { marginTop: i === 0 ? "0" : "22px" } }, [
          text("div", { style: { fontSize: "13px", fontWeight: "600", color: "var(--text-dim)", marginBottom: "2px" } }, group.league),
          h(
            "div",
            {},
            group.items.map((m, j) =>
              h("div", { style: { borderTop: j === 0 ? "none" : "0.5px solid var(--border-soft)" } }, [matchRow(m, props.favoriteMatchIds.includes(m.id), props)])
            )
          ),
        ])
      )
    ),
  ]);
}
