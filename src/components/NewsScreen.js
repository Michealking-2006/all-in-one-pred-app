import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { newsArticles } from "../data/mockData.js";

function gradientStyle([from, to]) {
  return `linear-gradient(135deg, ${from}, ${to})`;
}

function categoryChip(label) {
  return text(
    "span",
    {
      className: "mono",
      style: {
        display: "inline-block",
        fontSize: "10px",
        color: "#FFFFFF",
        background: "rgba(0,0,0,0.35)",
        padding: "4px 9px",
        borderRadius: "999px",
        letterSpacing: "0.02em",
      },
    },
    label.toUpperCase()
  );
}

function featuredCard(article) {
  return h(
    "div",
    {
      style: {
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
        height: "160px",
        background: gradientStyle(article.gradient),
        margin: "0 18px 18px",
      },
    },
    [
      h("i", {
        "data-lucide": "volleyball",
        "aria-hidden": "true",
        style: { position: "absolute", right: "-14px", bottom: "-14px", width: "110px", height: "110px", color: "rgba(255,255,255,0.15)" },
      }),
      h("div", { style: { position: "absolute", top: "12px", left: "14px" } }, [categoryChip(article.category)]),
      h("div", { style: { position: "absolute", left: "14px", right: "14px", bottom: "12px" } }, [
        text("div", { style: { color: "#FFFFFF", fontWeight: "700", fontSize: "16px", lineHeight: "1.3", marginBottom: "4px" } }, article.title),
        h("div", { className: "mono", style: { color: "rgba(255,255,255,0.75)", fontSize: "10px" } }, [text("span", {}, `${article.source} \u00b7 ${article.time}`)]),
      ]),
    ]
  );
}

function listItem(article) {
  return h("div", { style: { display: "flex", gap: "12px", padding: "14px 18px", borderBottom: "0.5px solid var(--border-soft)" } }, [
    h("div", {
      style: {
        flexShrink: "0",
        width: "72px",
        height: "72px",
        borderRadius: "10px",
        background: gradientStyle(article.gradient),
        position: "relative",
        overflow: "hidden",
      },
    }, [
      h("i", { "data-lucide": "volleyball", "aria-hidden": "true", style: { position: "absolute", right: "-8px", bottom: "-8px", width: "44px", height: "44px", color: "rgba(255,255,255,0.2)" } }),
    ]),
    h("div", { style: { flex: "1", minWidth: "0" } }, [
      text("div", { className: "mono eyebrow", style: { marginBottom: "4px" } }, article.category.toUpperCase()),
      text("div", { style: { fontSize: "13px", fontWeight: "600", lineHeight: "1.35", marginBottom: "4px" } }, article.title),
      h("div", { className: "mono", style: { fontSize: "10px", color: "var(--text-muted)" } }, [text("span", {}, `${article.source} \u00b7 ${article.time}`)]),
    ]),
  ]);
}

// props: { onBack }
export function NewsScreen({ onBack }) {
  const [featured, ...rest] = newsArticles;
  return h("div", { className: "screen" }, [
    PageHeader({ title: "News", onBack }),
    h("div", { style: { paddingTop: "16px" } }, [
      featured ? featuredCard(featured) : null,
      ...rest.map(listItem),
    ]),
  ]);
}
