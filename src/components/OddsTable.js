import { h, text } from "../utils/h.js";

export function OddsTable({ match }) {
  const odds = Array.isArray(match?.odds) ? match.odds : [];
  if (!odds.length) {
    return h("section", { className: "match-panel odds-panel" }, [
      h("div", { className: "odds-card card odds-empty" }, [
        text("strong", {}, "Odds unavailable"),
        text("span", {}, "No bookmaker prices are available for this match yet."),
      ]),
    ]);
  }

  const values = (key) => odds.map((row) => Number(row[key])).filter(Number.isFinite);
  const best = {
    h: Math.max(...values("h")),
    d: Math.max(...values("d")),
    a: Math.max(...values("a")),
  };

  return h("section", { className: "match-panel odds-panel" }, [
    h("div", { className: "odds-card card" }, [
      h("div", { className: "odds-row odds-head" }, [
        text("strong", {}, "BOOKMAKER"), text("strong", {}, "1"), text("strong", {}, "X"), text("strong", {}, "2"),
      ]),
      ...odds.map((row) => h("div", { className: "odds-row" }, [
        text("span", { className: "odds-book" }, row.book || "—"),
        oddsCell(row.h, best.h), oddsCell(row.d, best.d), oddsCell(row.a, best.a),
      ])),
    ]),
    h("div", { className: "odds-note" }, [
      h("span", { className: "odds-best-dot" }),
      text("span", {}, "Highest listed price highlighted"),
    ]),
  ]);
}

function oddsCell(value, best) {
  const number = Number(value);
  const valid = Number.isFinite(number);
  return text("span", { className: "odds-cell " + (valid && number === best ? "best" : "") }, valid ? number.toFixed(2) : "—");
}
