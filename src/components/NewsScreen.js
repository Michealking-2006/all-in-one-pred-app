import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { newsArticles } from "../data/mockData.js";
function gradientStyle([a,b]){return "linear-gradient(135deg,"+a+","+b+")";}
export function NewsScreen({onBack}){
 const [featured,...rest]=newsArticles;
 return h("main",{className:"screen news-screen"},[
  PageHeader({title:"News",onBack}),
  featured?h("article",{className:"news-featured",style:{background:gradientStyle(featured.gradient)}},[
   text("span",{className:"news-category"},featured.category.toUpperCase()),
   text("h1",{},featured.title),
   text("p",{},featured.snippet),
   text("span",{className:"news-meta"},featured.source+" · "+featured.time)
  ]):null,
  h("div",{className:"news-list"},rest.map(article=>h("article",{className:"news-item"},[
   h("div",{className:"news-thumb",style:{background:gradientStyle(article.gradient)}},[h("i",{"data-lucide":"newspaper"})]),
   h("div",{className:"news-copy"},[
    text("span",{className:"eyebrow"},article.category.toUpperCase()),
    text("strong",{},article.title),
    text("p",{},article.snippet),
    text("span",{className:"news-meta"},article.source+" · "+article.time)
   ])
  ])))
 ]);
}
