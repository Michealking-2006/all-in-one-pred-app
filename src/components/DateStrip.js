import { h, text } from "../utils/h.js";
const DAY_LABELS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export function DateStrip({selectedOffset,onSelectDay}){
 const today=new Date();
 const days=[-3,-2,-1,0,1,2,3].map(offset=>{const d=new Date(today);d.setDate(today.getDate()+offset);return{offset,label:offset===0?"Today":DAY_LABELS[d.getDay()],date:d.getDate()}});
 return h("div",{className:"date-strip"},days.map(({offset,label,date})=>{
  const active=offset===selectedOffset;
  return h("button",{className:"date-strip-day "+(active?"active":""),onClick:()=>onSelectDay(offset),"aria-pressed":active},[
   text("span",{className:"date-strip-label"},label),
   text("span",{className:"date-strip-number mono"},date)
  ]);
 }));
}