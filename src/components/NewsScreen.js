import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { metaLine } from "../utils/ui.js";
import { newsArticles } from "../data/mockData.js";
function gradientStyle([a,b]){return "linear-gradient(135deg,"+a+","+b+")";}
export function NewsScreen({onBack}){
 const [featured,...rest]=newsArticles;
 return h("main",{className:"screen news-screen"},[
  PageHeader({title:"News",onBack}),
  h("section",{className:"card sample-notice"},[h("i",{"data-lucide":"info"}),text("span",{},"Sample headlines. Live football news isn't connected yet.")]),
  featured?h("article",{className:"news-featured",style:{background:gradientStyle(featured.gradient)}},[
   text("span",{className:"news-category"},featured.category),
   text("h1",{},featured.title),
   text("p",{},featured.snippet),
   metaLine([featured.source,featured.time],"meta-line news-meta")
  ]):null,
  h("div",{className:"news-list"},rest.map(article=>h("article",{className:"news-item"},[
   h("div",{className:"news-thumb",style:{background:gradientStyle(article.gradient)}},[h("i",{"data-lucide":"newspaper"})]),
   h("div",{className:"news-copy"},[
    text("span",{className:"eyebrow"},article.category),
    text("strong",{},article.title),
    text("p",{},article.snippet),
    metaLine([article.source,article.time],"meta-line news-meta")
   ])
  ])))
 ]);
}
