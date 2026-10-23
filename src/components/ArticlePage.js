// A news story on our own address (/news/<words>-<id>): headline, picture, the publisher's summary,
// a clear button to the full story on the publisher's site, "More stories", and the ad/promotion
// spaces. The app shows the briefing; the publisher keeps the full text and gets the reader.
import { h, text } from "../utils/h.js";
import { metaLine, headerActions } from "../utils/ui.js";
import { PageHeader } from "./PageHeader.js";
import { SkeletonRow } from "./Skeleton.js";
import { placement } from "./Placement.js";
import { getArticle, relatedArticles, rememberArticle, timeAgo } from "../api/newsApi.js";
import { articlePath } from "../newsArticle.js";
import { tagsOf } from "../newsTags.js";
import { navigate } from "../router.js";
import { setPageSeo } from "../seo.js";
import { showToast } from "../toast.js";
import { showPhotos } from "../perf.js";

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

async function shareStory(article) {
  const url = location.origin + articlePath(article);
  try {
    if (navigator.share) { await navigator.share({ title: article.title, text: article.description?.slice(0, 140) || article.title, url }); return; }
    await navigator.clipboard.writeText(url);
    showToast("Link copied", "success");
  } catch (error) {
    if (error?.name !== "AbortError") showToast("Couldn't share this story", "error");
  }
}

function moreStories(id) {
  const items = relatedArticles(id, 4);
  if (!items.length) return null;
  return h("section", { className: "article-more", "aria-label": "More stories" }, [
    text("h2", { className: "article-more-title" }, "More stories"),
    h("div", { className: "news-list" }, items.map((a) => {
      rememberArticle(a);
      const link = h("a", { className: "news-item", href: articlePath(a) }, [
        a.image && showPhotos() ? h("img", { className: "news-thumb", src: a.image, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer", onError: (e) => e.target.remove() }) : h("div", { className: "news-thumb news-thumb-empty" }, [h("i", { "data-lucide": "newspaper" })]),
        h("div", { className: "news-copy" }, [text("strong", {}, a.title), metaLine([a.source, timeAgo(a.publishedAt)], "meta-line news-meta")]),
      ]);
      link.addEventListener("click", (event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) return; event.preventDefault(); navigate(articlePath(a)); });
      return link;
    })),
  ]);
}

function render(article, body) {
  const source = article.source || hostOf(article.url) || "the publisher";
  const tags = tagsOf(article);
  const ago = timeAgo(article.publishedAt);
  setPageSeo({
    title: article.title.slice(0, 70) + " | Scoutwave",
    description: (article.description || article.title).slice(0, 300),
    image: article.image || "", type: "article",
    jsonLd: {
      "@context": "https://schema.org", "@type": "NewsArticle", headline: article.title.slice(0, 110),
      ...(article.image ? { image: [article.image] } : {}), ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
      author: { "@type": "Organization", name: source }, publisher: { "@type": "Organization", name: "Scoutwave" },
      mainEntityOfPage: location.origin + articlePath(article),
    },
  });

  const readButton = h("a", { className: "primary-button article-read", href: article.url, target: "_blank", rel: "noopener noreferrer" }, [
    text("span", {}, `Read the full story on ${source}`),
    h("i", { "data-lucide": "external-link", "aria-hidden": "true" }),
  ]);

  body.replaceChildren(
    h("article", { className: "article" }, [
      article.image && showPhotos() ? h("img", { className: "article-hero", src: article.image, alt: "", decoding: "async", referrerpolicy: "no-referrer", onError: (e) => e.target.remove() }) : null,
      h("div", { className: "article-head" }, [
        h("div", { className: "article-source" }, [text("span", { className: "article-source-name" }, source), ago ? text("span", {}, ago) : null]),
        text("h1", { className: "article-title" }, article.title),
        tags.length ? h("div", { className: "news-article-tags" }, tags.map((t) => h("a", { className: "news-article-tag", href: "/news?tag=" + encodeURIComponent(t.id) }, "#" + t.label))) : null,
      ]),
      placement("news_top"),
      article.description ? text("p", { className: "article-summary" }, article.description) : null,
      placement("news_inline"),
      h("div", { className: "article-actions" }, [
        readButton,
        text("p", { className: "article-credit" }, `Summary from ${source}. The full story is on their site.`),
      ]),
      placement("news_bottom"),
    ]),
    moreStories(article.id)
  );
}

export function ArticlePage({ id, onBack }) {
  const body = h("div", { className: "article-body" }, [h("div", { className: "news-skeleton" }, [SkeletonRow({ lines: 3 }), SkeletonRow({ lines: 2 })])]);
  let current = null;
  const share = h("button", { type: "button", className: "icon-button", "aria-label": "Share this story", onClick: () => current && shareStory(current) }, [h("i", { "data-lucide": "share-2" })]);
  const root = h("main", { className: "screen article-page" }, [PageHeader({ title: "News", onBack, action: headerActions(share) }), body]);

  getArticle(id).then((article) => { current = article; render(article, body); }).catch((error) => {
    body.replaceChildren(h("div", { className: "error-state", role: "alert" }, [
      text("p", {}, error.message || "The story could not be loaded."),
      h("a", { className: "secondary-button", href: "/news" }, "Back to news"),
    ]));
  });
  return root;
}
