import { h, text } from "../utils/h.js";
import { SkeletonRow } from "./Skeleton.js";
import { getNews, timeAgo, rememberArticle } from "../api/newsApi.js";
import { articlePath } from "../newsArticle.js";
import { placement } from "./Placement.js";
import { NEWS_TAGS, tagById, tagsOf } from "../newsTags.js";
import { store } from "../store.js";

// Every story opens on our own address (/news/<words>-<id>). That page shows the briefing and sends
// the reader on to the publisher for the full text. The story is remembered so it opens instantly.
function storyLink(article, className, children) {
  rememberArticle(article);
  return h("a", {
    className,
    href: articlePath(article),
    "aria-label": article.title + (article.source ? ", " + article.source : ""),
  }, children);
}

function thumb(article, className) {
  if (!article.image) return h("div", { className: className + " news-thumb-empty" }, [h("i", { "data-lucide": "newspaper" })]);
  const img = h("img", { className, src: article.image, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.replaceWith(h("div", { className: className + " news-thumb-empty" }, [h("i", { "data-lucide": "newspaper" })])));
  return img;
}

function readMore() {
  return h("span", { className: "news-read-more" }, [text("span", {}, "Read story"), h("i", { "data-lucide": "chevron-right", "aria-hidden": "true" })]);
}

// The publisher, as a small badge with its first letter, so a list of stories is easy to scan.
function sourceBadge(article) {
  if (!article.source) return null;
  return h("span", { className: "news-source" }, [text("span", { className: "news-source-dot", "aria-hidden": "true" }, article.source.trim().charAt(0).toUpperCase()), text("span", {}, article.source)]);
}

// The hashtags an article is about, as small tappable chips. They sit inside
// the article link, so they are spans that swallow the click instead of buttons.
function articleTags(article, onPickTag) {
  const tags = tagsOf(article);
  if (!tags.length) return null;
  return h("span", { className: "news-article-tags" }, tags.map((tag) => {
    const chip = h("span", { className: "news-article-tag", role: "button", tabindex: "0", "aria-label": "Filter news by #" + tag.label }, "#" + tag.label);
    const pick = (event) => { event.preventDefault(); event.stopPropagation(); onPickTag(tag.id); };
    chip.addEventListener("click", pick);
    chip.addEventListener("keydown", (event) => { if (event.key === " " || event.key === "Enter") pick(event); });
    return chip;
  }));
}

function featuredCard(article, onPickTag) {
  return storyLink(article, "news-featured" + (article.image ? " has-image" : ""), [
    article.image ? h("img", { className: "news-featured-image", src: article.image, alt: "", decoding: "async", referrerpolicy: "no-referrer", onError: (e) => e.target.remove() }) : null,
    h("div", { className: "news-featured-body" }, [
      text("h2", { className: "news-featured-title" }, article.title),
      article.description ? text("p", {}, article.description) : null,
      h("div", { className: "news-meta-row" }, [sourceBadge(article), text("span", { className: "news-time" }, timeAgo(article.publishedAt))]),
      articleTags(article, onPickTag),
      readMore(),
    ]),
  ]);
}

function itemCard(article, onPickTag) {
  return storyLink(article, "news-item", [
    thumb(article, "news-thumb"),
    h("div", { className: "news-copy" }, [
      text("strong", {}, article.title),
      article.description ? text("p", {}, article.description) : null,
      h("div", { className: "news-meta-row" }, [sourceBadge(article), text("span", { className: "news-time" }, timeAgo(article.publishedAt))]),
      articleTags(article, onPickTag),
    ]),
  ]);
}

const readTagFromUrl = () => {
  const id = new URLSearchParams(window.location.search).get("tag") || "";
  return tagById(id) ? id : "";
};

function writeTagToUrl(id) {
  try {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("tag", id); else url.searchParams.delete("tag");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  } catch { /* not critical */ }
}

export function NewsScreen() {
  let tag = readTagFromUrl();
  let generation = 0; // bumps on every filter change so a slow response for an old tag is ignored
  let page = 0;
  let featuredShown = false;
  let seen = new Set();
  let placed = false; // the "in the list" ad/promotion space is shown once, after the 4th story
  let observer = null;

  const body = h("div", { className: "news-body" });
  const list = h("div", { className: "news-list", hidden: true });
  const more = h("div", { className: "news-more", hidden: true });

  // "Your club" goes first when its colours are chosen and there is news for it.
  const favouriteId = store.getState().clubTheme?.id;
  const favourite = NEWS_TAGS.find((t) => t.club && t.id === favouriteId);
  const ordered = favourite ? [favourite, ...NEWS_TAGS.filter((t) => t !== favourite)] : NEWS_TAGS;

  const chips = new Map();
  const makeChip = (id, label, extra = "") => {
    const chip = h("button", { type: "button", role: "tab", className: "tag-chip" + extra, "aria-selected": "false", onClick: () => selectTag(id) }, label);
    chips.set(id, chip);
    return chip;
  };
  const tagRow = h("div", { className: "tag-row", role: "tablist", "aria-label": "Filter news by hashtag" }, [
    makeChip("", "All"),
    ...ordered.map((t) => makeChip(t.id, (t === favourite ? "\u2605 " : "#") + t.label)),
  ]);

  const root = h("main", { className: "screen news-screen" }, [
    h("header", { className: "page-intro" }, [
      text("span", { className: "section-kicker" }, "Football"),
      h("div", { className: "page-intro-row" }, [text("h1", {}, "News")]),
      text("p", {}, "Headlines from across the game. Tap a story for the summary, then read the full piece at the source."),
    ]),
    tagRow,
    body,
    list,
    more,
  ]);

  const skeleton = () => h("div", { className: "news-skeleton" }, [SkeletonRow({ lines: 2 }), SkeletonRow({ lines: 2 }), SkeletonRow({ lines: 2 })]);

  function markActive() {
    chips.forEach((chip, id) => {
      const on = id === tag;
      chip.classList.toggle("active", on);
      chip.setAttribute("aria-selected", String(on));
    });
    chips.get(tag)?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }

  function selectTag(id) {
    if (id === tag) return;
    tag = id;
    writeTagToUrl(id);
    generation++;
    page = 0;
    featuredShown = false;
    placed = false;
    seen = new Set();
    body.replaceChildren();
    list.replaceChildren();
    list.hidden = true;
    more.hidden = true;
    markActive();
    loadPage();
  }

  function showError(error, retry) {
    return h("div", { className: "error-state", role: "alert" }, [
      text("p", {}, error?.message || "News could not be loaded."),
      h("button", { type: "button", className: "secondary-button", onClick: retry }, "Try again"),
    ]);
  }

  function loadPage() {
    const mine = generation;
    const next = page + 1;
    const first = next === 1;
    if (first) body.replaceChildren(skeleton());
    else more.replaceChildren(skeleton());

    getNews(next, tag).then((data) => {
      if (mine !== generation) return; // the filter changed while this was loading
      page = next;
      const fresh = data.articles.filter((a) => !seen.has(a.id));
      fresh.forEach((a) => seen.add(a.id));
      body.replaceChildren();
      more.replaceChildren();

      if (first && !fresh.length) {
        const label = tag ? "#" + tagById(tag).label : "";
        body.appendChild(h("div", { className: "empty-state" }, label ? `No ${label} stories right now. Try another tag.` : "No football news right now. Check back soon."));
        return;
      }
      let rest = fresh;
      if (!featuredShown && fresh.length) {
        body.appendChild(featuredCard(fresh[0], selectTag));
        featuredShown = true;
        rest = fresh.slice(1);
      }
      rest.forEach((a) => {
        list.appendChild(itemCard(a, selectTag));
        if (!placed && list.querySelectorAll(".news-item").length === 4) {
          const slot = placement("news_list");
          if (slot) { list.appendChild(slot); placed = true; }
        }
      });
      list.hidden = list.children.length === 0;

      // Another page exists if the provider says there are more than we have shown.
      const hasMore = data.articles.length > 0 && data.found > seen.size;
      more.hidden = !hasMore;
      if (hasMore) {
        const button = h("button", { type: "button", className: "secondary-button news-more-button", onClick: loadPage }, "Load more");
        more.appendChild(button);
        // Keep reading: the next page loads by itself when the button scrolls into view (the button stays as a fallback).
        observer?.disconnect();
        if ("IntersectionObserver" in window) {
          observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting) && button.isConnected) { observer.disconnect(); loadPage(); } }, { rootMargin: "400px" });
          observer.observe(button);
        }
      }
    }).catch((error) => {
      if (mine !== generation) return;
      if (first) body.replaceChildren(showError(error, loadPage));
      else { more.replaceChildren(showError(error, loadPage)); more.hidden = false; }
    });
  }

  markActive();
  loadPage();
  return root;
}
