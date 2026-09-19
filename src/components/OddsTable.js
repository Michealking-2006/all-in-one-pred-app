import { h, text } from "../utils/h.js";
export function OddsTable({match}){
 const best={h:Math.max(...match.odds.map(o=>o.h)),d:Math.max(...match.odds.map(o=>o.d)),a:Math.max(...match.odds.map(o=>o.a))};
 return h("section",{className:"match-panel odds-panel"},[
  h("div",{className:"odds-card card"},[
   h("div",{className:"odds-row odds-head"},[text("strong",{},"BOOKMAKER"),text("strong",{},"1"),text("strong",{},"X"),text("strong",{},"2")]),
   ...match.odds.map(o=>h("div",{className:"odds-row"},[
    text("span",{className:"odds-book"},o.book),
    oddsCell(o.h,best.h),oddsCell(o.d,best.d),oddsCell(o.a,best.a)
   ]))
  ]),
  h("div",{className:"odds-note"},[h("span",{className:"odds-best-dot"}),text("span",{},"Highest listed price highlighted")])
 ]);
}
function oddsCell(value,best){return text("span",{className:"odds-cell "+(value===best?"best":"")},value.toFixed(2));}