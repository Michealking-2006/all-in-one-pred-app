# Search engine optimisation

Scoutwave is a client-side app, which search engines read only partly. So the server hands **crawlers and link-preview bots** (Google, Bing, Apple, DuckDuckGo, WhatsApp, X, Facebook, Slack, Discord, Reddit, Mastodon and AI search crawlers; the list is in `vercel.json`) a small, fully rendered HTML page for each address, while people get the app. This is called dynamic rendering: search engines accept it, but it only works if the two stay equivalent, so the pages carry the same facts as the app.

## What each kind of page gets
| Address | Content for crawlers | Structured data |
|---|---|---|
| `/` | today's matches, every main competition | WebSite (with site search), Organization |
| `/league/<id>-<name>` | the league table, links to clubs | BreadcrumbList, ItemList |
| `/club/<id>-<name>` | facts, stadium link, last and next five matches, recent form in the description | SportsTeam, BreadcrumbList |
| `/player/<id>-<name>` | profile, club, this season's appearances, goals, assists | Person, BreadcrumbList |
| `/venue/<id>-<name>` | address, capacity, surface | StadiumOrArena, BreadcrumbList |
| `/match/<id>` | status, score, scorers, venue, links to both clubs | SportsEvent (with end time), BreadcrumbList |
| `/news/<words>-<id>` | headline, the publisher's summary, link to the full story | NewsArticle, BreadcrumbList |

Every page has a unique title and description, a canonical link, Open Graph and Twitter tags (the club crest, player photo or stadium picture is the preview image), an RSS link, and verification tags when configured.

## Technical behaviour
- **Real 404s.** An address that isn't a page, or an id the data provider doesn't know, answers a real 404 with `noindex` and no canonical, so search engines drop it instead of indexing empty pages.
- **One address per thing.** `/club/33`, `/club/33-wrong-name` and `/club/33-manchester-united` all end up at the last one by a 301 redirect, so rankings don't split. Trailing slashes redirect too (`trailingSlash: false`).
- **Sitemaps.** `/sitemap.xml` is an index of `sitemap-pages`, `-leagues`, `-matches` (yesterday, today, tomorrow, with real dates) and `-news` (our own story pages), plus `-clubs` when `SITEMAP_CLUBS=1`. Only real `lastmod` dates are given; `changefreq` and `priority` are left out because search engines ignore them.
- **News feed** at `/feed.xml` (RSS) of the latest stories at their own addresses.
- **robots.txt** closes the API, admin and private screens. `AI_CRAWLERS` sets the policy for AI crawlers: `allow` (default), `training-only` (blocks the ones that collect training data, keeps AI search and answer crawlers) or `block`. robots.txt is a request that well-behaved crawlers honour, not enforcement, and the crawler names change, so check each vendor's documentation now and then.
- **`/llms.txt`** is a plain summary for AI assistants. It is an emerging convention; no search engine has promised to use it, so treat it as a cheap extra.
- `/api/*` answers carry `X-Robots-Tag: noindex`.

## The football API budget
Club, player, venue, league and match pages each need football API requests. Search engines can ask for thousands of pages, so the total spent on crawlers is capped at `SEO_MAX_CALLS_PER_DAY` (400 by default). Past the cap pages are still served (without the data, cached for a minute), so a crawl can never use up the quota the app needs. Pages are cached at the edge: 6 hours for clubs and players, a day for stadiums, an hour for finished matches and leagues. admin > SEO shows today's use.

## Set up (once)
1. Set `SITE_URL` in Vercel to your https address (admin > Overview shows a check). Redirect `www` to the bare domain (or the reverse) in the Vercel domain settings.
2. In **Google Search Console** add the property, choose the HTML tag method, put the tag's `content` value in `GOOGLE_SITE_VERIFICATION`, redeploy, verify, then submit `https://your-site/sitemap.xml`. Do the same in **Bing Webmaster Tools** with `BING_SITE_VERIFICATION` (Bing also feeds DuckDuckGo and others).
3. Open admin > **SEO**, press "Check a standard sample" and fix anything listed. Check an address you care about by typing it in (for example a club).
4. Optional: `TWITTER_SITE`, `SITEMAP_CLUBS=1`, `AI_CRAWLERS`.

## Honest limits
- No one can promise rankings. This makes pages indexable, accurate and rich; ranking also depends on competition, links to your site and time.
- Preview pictures are crests and photos (square). Generating a designed 1200x630 picture per match needs an image library and a server that can render it; not built.
- One language (English), so no `hreflang`.
- The news sitemap lists our story pages but is not a Google News sitemap: those stories carry only the publisher's summary, which isn't enough for Google News inclusion, so no claim is made.
- The `X-Robots-Tag` header is applied by path; if Vercel evaluates it after rewriting, the sitemap and feed (which are rewritten from non-`/api` addresses) are unaffected either way.
