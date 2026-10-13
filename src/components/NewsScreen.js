import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { metaLine } from "../utils/ui.js";
import { SkeletonRow } from "./Skeleton.js";
import { getNews, timeAgo } from "../api/newsApi.js";

// Every article opens its original page in a new tab: the app shows the
// briefing (headline + summary), the publisher keeps the full story.
function storyLink(article, className, children) {
  return h("a", {
    className,
    href: article.url,
    target: "_blank",
    rel: "noopener noreferrer",
    "aria-label": article.title + (article.source ? " \u2014 " + article.source : "") + ". Opens the full story in a new tab.",
  }, children);
}

function thumb(article, className) {
  if (!article.image) return h("div", { className: className + " news-thumb-empty" }, [h("i", { "data-lucide": "newspaper" })]);
  const img = h("img", { className, src: article.image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.replaceWith(h("div", { className: className + " news-thumb-empty" }, [h("i", { "data-lucide": "newspaper" })])));
  return img;
}

function readMore() {
  return h("span", { className: "news-read-more" }, [text("span", {}, "Read full story"), h("i", { "data-lucide": "external-link", "aria-hidden": "true" })]);
}

function featuredCard(article) {
  return storyLink(article, "news-featured" + (article.image ? " has-image" : ""), [
    article.image ? h("img", { className: "news-featured-image", src: article.image, alt: "", referrerpolicy: "no-referrer", onError: (e) => e.target.remove() }) : null,
    h("div", { className: "news-featured-body" }, [
      text("h1", {}, article.title),
      article.description ? text("p", {}, article.description) : null,
      metaLine([article.source, timeAgo(article.publishedAt)], "meta-line news-meta"),
      readMore(),
    ]),
  ]);
}

function itemCard(article) {
  return storyLink(article, "news-item", [
    thumb(article, "news-thumb"),
    h("div", { className: "news-copy" }, [
      text("strong", {}, article.title),
      article.description ? text("p", {}, article.description) : null,
      metaLine([article.source, timeAgo(article.publishedAt)], "meta-line news-meta"),
      readMore(),
    ]),
  ]);
}

export function NewsScreen({ onBack }) {
  const body = h("div", { className: "news-body" });
  const list = h("div", { className: "news-list", hidden: true });
  const more = h("div", { className: "news-more", hidden: true });
  const root = h("main", { className: "screen news-screen" }, [PageHeader({ title: "News", onBack }), body, list, more]);

  let page = 0;
  let featuredShown = false;
  let seen = new Set();

  const skeleton = () => h("div", { className: "news-skeleton" }, [SkeletonRow({ lines: 2 }), SkeletonRow({ lines: 2 }), SkeletonRow({ lines: 2 })]);

  function showError(error, retry) {
    return h("div", { className: "error-state" }, [
      text("p", {}, error?.message || "News could not be loaded."),
      h("button", { type: "button", className: "secondary-button", onClick: retry }, "Try again"),
    ]);
  }

  function loadPage() {
    const next = page + 1;
    const first = next === 1;
    if (first) body.replaceChildren(skeleton());
    else more.replaceChildren(skeleton());

    getNews(next).then((data) => {
      page = next;
      const fresh = data.articles.filter((a) => !seen.has(a.id));
      fresh.forEach((a) => seen.add(a.id));
      body.replaceChildren();
      more.replaceChildren();

      if (first && !fresh.length) {
        body.appendChild(h("div", { className: "empty-state" }, "No football news right now. Check back soon."));
        return;
      }
      let rest = fresh;
      if (!featuredShown && fresh.length) {
        body.appendChild(featuredCard(fresh[0]));
        featuredShown = true;
        rest = fresh.slice(1);
      }
      rest.forEach((a) => list.appendChild(itemCard(a)));
      list.hidden = list.children.length === 0;

      // Another page exists if the provider says there are more than we have shown.
      const hasMore = data.articles.length > 0 && data.found > seen.size;
      more.hidden = !hasMore;
      if (hasMore) more.appendChild(h("button", { type: "button", className: "secondary-button news-more-button", onClick: loadPage }, "Load more"));
    }).catch((error) => {
      if (first) body.replaceChildren(showError(error, loadPage));
      else { more.replaceChildren(showError(error, loadPage)); more.hidden = false; }
    });
  }

  loadPage();
  return root;
}
