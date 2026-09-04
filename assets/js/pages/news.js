/* =========================================================
   SCOUTWAVE NEWS
   TheNewsAPI
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     CONFIG
     ======================================================= */

  const API_KEY = "PVX25TUHFg9NN753CWZXxkNbSPnlchlXRiwu1pJp";

  const NEWS_API =
    "https://api.thenewsapi.com/v1/news/all";

  const ARTICLE_API =
    "https://api.thenewsapi.com/v1/news/uuid";

  const LIMIT = 20;

  const CACHE_TTL = 5 * 60 * 1000;

  const CACHE_PREFIX =
    "scoutwave-news-v3";

  const FALLBACK_IMAGE =
    "/assets/images/news/featured.jpg";


  /* =======================================================
     STATE
     ======================================================= */

  const state = {
    category: "latest",
    articles: [],
    loading: false,
    requestId: 0,
    root: null
  };


  /* =======================================================
     CATEGORY CONFIG
     ======================================================= */

  const CATEGORY_CONFIG = {
    latest: {
      search:
        '"football"|"soccer"|"Premier League"|"Champions League"|"La Liga"|"Serie A"|"Bundesliga"|"Europa League"'
    },

    football: {
      search:
        '"football"|"soccer"|"Premier League"|"Champions League"|"La Liga"|"Serie A"|"Bundesliga"|"Europa League"'
    },

    transfers: {
      search:
        'football transfers|soccer transfers|football signing|soccer signing'
    },

    "premier-league": {
      search:
        '"Premier League"'
    },

    "champions-league": {
      search:
        '"Champions League"'
    }
  };


  /* =======================================================
     HELPERS
     ======================================================= */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(
      root.querySelectorAll(selector)
    );


  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function slugify(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }


  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }


  function timeAgo(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const seconds = Math.max(
      0,
      Math.floor(
        (Date.now() - date.getTime()) / 1000
      )
    );

    if (seconds < 60) {
      return "Just now";
    }

    const minutes =
      Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours =
      Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days =
      Math.floor(hours / 24);

    if (days < 7) {
      return `${days}d ago`;
    }

    return formatDate(value);
  }


  function articlePath(article) {
    return `/news/${slugify(article.title)}-${article.uuid}`;
  }


  function getArticleUUID(
    pathname = location.pathname
  ) {
    const match = String(pathname).match(
      /-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/?$/i
    );

    return match?.[1] || null;
  }


  /* =======================================================
     CACHE
     ======================================================= */

  function makeCacheKey(type, value) {
    return `${CACHE_PREFIX}:${type}:${value}`;
  }


  function readCache(key) {
    try {
      const raw =
        localStorage.getItem(key);

      if (!raw) {
        return null;
      }

      const cached =
        JSON.parse(raw);

      if (
        !cached ||
        !cached.timestamp
      ) {
        return null;
      }

      if (
        Date.now() -
          cached.timestamp >
        CACHE_TTL
      ) {
        localStorage.removeItem(key);
        return null;
      }

      return cached.data;

    } catch {
      return null;
    }
  }


  function writeCache(key, data) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          timestamp: Date.now(),
          data
        })
      );
    } catch {
      /* localStorage is optional */
    }
  }


  /* =======================================================
     API
     ======================================================= */

  async function apiRequest(
    endpoint,
    params = {}
  ) {
    if (!API_KEY.trim()) {
      throw new Error(
        "TheNewsAPI key has not been configured."
      );
    }

    const query =
      new URLSearchParams({
        api_token: API_KEY,
        ...params
      });

    const response =
      await fetch(
        `${endpoint}?${query.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          }
        }
      );

    const data =
      await response
        .json()
        .catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `TheNewsAPI request failed (${response.status}).`
      );
    }

    if (data?.error) {
      throw new Error(
        data.error.message ||
        "TheNewsAPI returned an error."
      );
    }

    return data;
  }


  /* =======================================================
     NORMALIZE
     ======================================================= */

  function normalizeArticle(article) {
    return {
      uuid:
        article?.uuid || "",

      title:
        article?.title ||
        "Untitled",

      description:
        article?.description ||
        "",

      snippet:
        article?.snippet ||
        "",

      url:
        article?.url ||
        "#",

      image_url:
        article?.image_url ||
        "",

      source:
        article?.source ||
        "Unknown source",

      published_at:
        article?.published_at ||
        "",

      categories:
        Array.isArray(
          article?.categories
        )
          ? article.categories
          : [],

      keywords:
        article?.keywords ||
        ""
    };
  }


  /* =======================================================
     FOOTBALL FILTER
     ======================================================= */

  function isFootballArticle(article) {
    const text = [
      article.title,
      article.description,
      article.snippet,
      article.source,
      article.keywords,
      ...(article.categories || [])
    ]
      .join(" ")
      .toLowerCase();

    const americanSports = [
      "nfl",
      "nba",
      "mlb",
      "nhl",
      "touchdown",
      "quarterback",
      "quarterback",
      "wide receiver",
      "running back",
      "super bowl",
      "superbowl",
      "american football",
      "gridiron",
      "nfl draft"
    ];

    if (
      americanSports.some(term =>
        text.includes(term)
      )
    ) {
      return false;
    }

    const footballTerms = [
      "soccer",
      "football",
      "premier league",
      "champions league",
      "europa league",
      "conference league",
      "la liga",
      "serie a",
      "bundesliga",
      "ligue 1",
      "uefa",
      "fifa",
      "fa cup",
      "copa del rey",
      "world cup",
      "club world cup",
      "transfer",
      "transfers"
    ];

    return footballTerms.some(term =>
      text.includes(term)
    );
  }


  /* =======================================================
     CATEGORY LABEL
     ======================================================= */

  function categoryLabel(category) {
    const labels = {
      latest: "Football",
      football: "Football",
      transfers: "Transfers",
      "premier-league":
        "Premier League",
      "champions-league":
        "Champions League"
    };

    return (
      labels[category] ||
      "Football"
    );
  }


  /* =======================================================
     CURRENT NEWS ROOT
     ======================================================= */

  function getNewsRoot() {
    return $("#newsPage");
  }


  /* =======================================================
     LOADER / EMPTY
     ======================================================= */

  function setLoader(show) {
    const loader =
      $("#newsLoader");

    if (!loader) {
      return;
    }

    loader.hidden = !show;

    loader.setAttribute(
      "aria-hidden",
      String(!show)
    );
  }


  function setEmpty(show) {
    const empty =
      $("#newsEmpty");

    if (!empty) {
      return;
    }

    empty.hidden = !show;
  }


  /* =======================================================
     CATEGORIES UI
     ======================================================= */

  function updateCategoryUI(root) {
    $$(
      "[data-news-category]",
      root
    ).forEach(button => {
      const active =
        button.dataset.newsCategory ===
        state.category;

      button.classList.toggle(
        "is-active",
        active
      );

      button.setAttribute(
        "aria-selected",
        String(active)
      );
    });
  }


  /* =======================================================
     FEATURED
     ======================================================= */

  function renderFeatured(
    article,
    root
  ) {
    const card =
      $(".news-featured-card", root);

    if (
      !card ||
      !article
    ) {
      return;
    }

    const image =
      $(".news-featured-image img", card);

    const tag =
      $(".news-tag", card);

    const title =
      $("h2", card);

    const meta =
      $(".news-meta", card);

    card.href =
      articlePath(article);

    card.dataset.newsId =
      article.uuid;

    if (image) {
      image.src =
        article.image_url ||
        FALLBACK_IMAGE;

      image.alt =
        article.title;

      image.onerror = () => {
        image.src =
          FALLBACK_IMAGE;
      };
    }

    if (tag) {
      tag.textContent =
        "Featured";
    }

    if (title) {
      title.textContent =
        article.title;
    }

    if (meta) {
      meta.innerHTML = `
        <span>
          ${escapeHTML(
            article.source
          )}
        </span>

        <span>·</span>

        <span>
          ${escapeHTML(
            timeAgo(
              article.published_at
            )
          )}
        </span>
      `;
    }
  }


  /* =======================================================
     CARD
     ======================================================= */

  function renderCard(article) {
    const description =
      article.description ||
      article.snippet ||
      "";

    const label =
      categoryLabel(
        state.category
      );

    return `
      <article
        class="news-card"
        data-news-id="${escapeHTML(
          article.uuid
        )}"
        data-news-category="${escapeHTML(
          state.category
        )}"
      >

        <a
          href="${escapeHTML(
            articlePath(article)
          )}"
          class="news-card-link"
        >

          <div class="news-card-image">

            ${
              article.image_url
                ? `
                  <img
                    src="${escapeHTML(
                      article.image_url
                    )}"
                    alt="${escapeHTML(
                      article.title
                    )}"
                    loading="lazy"
                    onerror="
                      this.style.display='none'
                    "
                  >
                `
                : ""
            }

          </div>


          <div class="news-card-content">

            <span
              class="news-card-category"
            >
              ${escapeHTML(label)}
            </span>


            <h3>
              ${escapeHTML(
                article.title
              )}
            </h3>


            ${
              description
                ? `
                  <p>
                    ${escapeHTML(
                      description
                    )}
                  </p>
                `
                : ""
            }


            <div class="news-card-meta">

              <span>
                ${escapeHTML(
                  article.source
                )}
              </span>

              <span>·</span>

              <span>
                ${escapeHTML(
                  timeAgo(
                    article.published_at
                  )
                )}
              </span>

            </div>

          </div>

        </a>

      </article>
    `;
  }


  /* =======================================================
     LIST
     ======================================================= */

  function renderList(root) {
    const list =
      $("#newsList", root);

    if (!list) {
      return;
    }

    if (!state.articles.length) {
      list.innerHTML = "";
      setEmpty(true);
      return;
    }

    setEmpty(false);

    list.innerHTML =
      state.articles
        .map(renderCard)
        .join("");
  }


  /* =======================================================
     LOAD NEWS
     ======================================================= */

  async function loadNews(
    root,
    force = false
  ) {
    if (!root || state.loading) {
      return;
    }

    state.loading = true;

    const requestId =
      ++state.requestId;

    const list =
      $("#newsList", root);

    if (list) {
      list.innerHTML = "";
    }

    setEmpty(false);
    setLoader(true);

    const config =
      CATEGORY_CONFIG[
        state.category
      ] ||
      CATEGORY_CONFIG.latest;

    const params = {
      language: "en",
      categories: "sports",
      search: config.search,
      search_fields:
        "title,description,keywords",
      sort:
        state.category === "transfers" ||
        state.category === "premier-league" ||
        state.category === "champions-league"
          ? "relevance_score"
          : "published_at",
      page: "1",
      limit:
        String(LIMIT)
    };

    const key =
      makeCacheKey(
        "list",
        `${state.category}:1`
      );

    try {
      let data =
        force
          ? null
          : readCache(key);

      if (!data) {
        data =
          await apiRequest(
            NEWS_API,
            params
          );

        writeCache(
          key,
          data
        );
      }

      if (
        requestId !==
        state.requestId
      ) {
        return;
      }

      const incoming =
        Array.isArray(data?.data)
          ? data.data
              .map(normalizeArticle)
              .filter(
                isFootballArticle
              )
          : [];

      const seen =
        new Set();

      state.articles =
        incoming.filter(article => {
          if (
            !article.uuid ||
            seen.has(
              article.uuid
            )
          ) {
            return false;
          }

          seen.add(
            article.uuid
          );

          return true;
        });

      renderFeatured(
        state.articles[0],
        root
      );

      renderList(root);

    } catch (error) {
      if (
        requestId !==
        state.requestId
      ) {
        return;
      }

      console.error(
        "[Scoutwave News]",
        error
      );

      if (list) {
        list.innerHTML = `
          <article class="news-error">

            <h2>
              Unable to load news
            </h2>

            <p>
              ${escapeHTML(
                error.message ||
                "Something went wrong."
              )}
            </p>

            <button
              type="button"
              data-news-retry
            >
              Try again
            </button>

          </article>
        `;

        $(
          "[data-news-retry]",
          list
        )?.addEventListener(
          "click",
          () =>
            loadNews(
              root,
              true
            )
        );
      }

    } finally {
      if (
        requestId ===
        state.requestId
      ) {
        state.loading = false;
        setLoader(false);
      }
    }
  }


  /* =======================================================
     SINGLE ARTICLE
     ======================================================= */

  async function getArticle(
    uuid
  ) {
    if (!uuid) {
      throw new Error(
        "Article ID is missing."
      );
    }

    const key =
      makeCacheKey(
        "article",
        uuid
      );

    const cached =
      readCache(key);

    if (cached) {
      return normalizeArticle(
        cached
      );
    }

    const data =
      await apiRequest(
        `${ARTICLE_API}/${encodeURIComponent(
          uuid
        )}`,
        {
          language: "en"
        }
      );

    const article =
      normalizeArticle(
        data
      );

    writeCache(
      key,
      article
    );

    return article;
  }


  /* =======================================================
     ARTICLE VIEW
     ======================================================= */

  function renderArticle(
    article
  ) {
    const main =
      $("#main-page");

    if (!main) {
      return;
    }

    main.innerHTML = `
      <article
        class="news-article-page"
      >

        <div
          class="news-article-container"
        >

          <a
            href="/news"
            class="news-article-back"
          >
            ← Back to news
          </a>


          <header
            class="news-article-header"
          >

            <div
              class="news-article-meta"
            >

              <span>
                ${escapeHTML(
                  article.source
                )}
              </span>

              <span>·</span>

              <time
                datetime="${escapeHTML(
                  article.published_at
                )}"
              >
                ${escapeHTML(
                  formatDate(
                    article.published_at
                  )
                )}
              </time>

            </div>


            <h1>
              ${escapeHTML(
                article.title
              )}
            </h1>


            ${
              article.description
                ? `
                  <p
                    class="
                      news-article-lead
                    "
                  >
                    ${escapeHTML(
                      article.description
                    )}
                  </p>
                `
                : ""
            }

          </header>


          ${
            article.image_url
              ? `
                <figure
                  class="
                    news-article-hero
                  "
                >

                  <img
                    src="${escapeHTML(
                      article.image_url
                    )}"
                    alt="${escapeHTML(
                      article.title
                    )}"
                    loading="eager"
                    onerror="
                      this.style.display='none'
                    "
                  >

                </figure>
              `
              : ""
          }


          <div
            class="
              news-article-content
            "
          >

            ${
              article.description
                ? `
                  <p>
                    ${escapeHTML(
                      article.description
                    )}
                  </p>
                `
                : ""
            }


            ${
              article.snippet &&
              article.snippet !==
                article.description
                ? `
                  <p>
                    ${escapeHTML(
                      article.snippet
                    )}
                  </p>
                `
                : ""
            }


            <div
              class="
                news-article-source
              "
            >

              <strong>
                Full story
              </strong>

              <p>
                The complete story is
                available from the
                original publisher.
              </p>

              <a
                href="${escapeHTML(
                  article.url
                )}"
                target="_blank"
                rel="noopener noreferrer"
                class="
                  news-read-original
                "
              >
                Read full story
                <span aria-hidden="true">
                  ↗
                </span>
              </a>

            </div>

          </div>

        </div>

      </article>
    `;

    document.title =
      `${article.title} | Scoutwave`;
  }


  /* =======================================================
     ARTICLE ROUTE
     ======================================================= */

  async function initArticle() {
    const uuid =
      getArticleUUID();

    if (!uuid) {
      return;
    }

    setLoader(true);

    try {
      const article =
        await getArticle(uuid);

      /*
       * Make sure the router has not
       * moved to another URL while
       * the request was running.
       */

      if (
        getArticleUUID() !== uuid
      ) {
        return;
      }

      renderArticle(article);

    } catch (error) {
      console.error(
        "[Scoutwave News Article]",
        error
      );

      const main =
        $("#main-page");

      if (main) {
        main.innerHTML = `
          <section
            class="news-article-page"
          >

            <div
              class="
                news-article-container
              "
            >

              <a
                href="/news"
                class="news-article-back"
              >
                ← Back to news
              </a>

              <h1>
                Article unavailable
              </h1>

              <p>
                ${escapeHTML(
                  error.message ||
                  "Unable to load article."
                )}
              </p>

            </div>

          </section>
        `;
      }

    } finally {
      setLoader(false);
    }
  }


  /* =======================================================
     EVENT DELEGATION
     ======================================================= */

  function bindEvents(root) {
    if (
      !root ||
      root.dataset.newsEventsBound === "true"
    ) {
      return;
    }

    root.dataset.newsEventsBound =
      "true";


    root.addEventListener(
      "click",
      event => {

        const categoryButton =
          event.target.closest(
            "[data-news-category]"
          );

        if (
          categoryButton &&
          root.contains(
            categoryButton
          )
        ) {
          const category =
            categoryButton.dataset
              .newsCategory;

          if (
            !CATEGORY_CONFIG[
              category
            ]
          ) {
            return;
          }

          if (
            state.category ===
            category
          ) {
            return;
          }

          state.category =
            category;

          updateCategoryUI(root);

          loadNews(
            root,
            true
          );

          return;
        }


        const refresh =
          event.target.closest(
            "[data-news-refresh]"
          );

        if (
          refresh &&
          root.contains(refresh)
        ) {
          loadNews(
            root,
            true
          );
        }

      }
    );
  }


  /* =======================================================
     NEWS PAGE INIT
     ======================================================= */

  async function initNewsPage() {
    const root =
      getNewsRoot();

    if (!root) {
      return;
    }

    /*
     * Reset for every router mount.
     */

    state.root = root;
    state.category = "latest";
    state.articles = [];
    state.loading = false;

    updateCategoryUI(root);

    bindEvents(root);

    await loadNews(
      root,
      false
    );
  }


  /* =======================================================
     MAIN INIT
     ======================================================= */

  async function init() {
    /*
     * No authentication.
     * No Supabase.
     * No VerifyAuthStatus.
     */

    if (
      getArticleUUID()
    ) {
      await initArticle();
      return;
    }

    await initNewsPage();
  }


  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.ScoutwaveNews = {
    init,
    loadNews,
    getArticle,
    getArticleUUID,
    articlePath,
    refresh: () => {
      const root =
        getNewsRoot();

      if (root) {
        return loadNews(
          root,
          true
        );
      }
    }
  };


  /* =======================================================
     START
     ======================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }

})();