# Changes in 0.38.0 — ready for a lot more visitors

The thing that limits Scoutwave under heavy traffic is the football provider's daily request quota, not the servers (Vercel serves the cached answers). The changes protect that quota:

- **One cached list of matches for the whole world.** The day's match list is the most requested thing in the app (every viewer, every minute while a game is on), and it was cached once per time zone, so 25 time zones meant 25 provider requests every 30 seconds on a match day. The app now asks for UTC days, which are the same URL for everyone, and keeps the matches that fall on the user's own day. Most visitors load two lists instead of one, and the second is nearly always already cached. Matches still appear on the right local day (checked in Tokyo time and UTC in the tests).
- **No stampede when a cached answer expires.** If many people ask for the same thing in the same instant, a server instance now asks the provider once and shares the answer (before, each of them could trigger its own request).
- **Less background traffic to our own API.** The cache counters sent to `/api/usage` (one function call and one database write each) go out every 15 minutes, and no more than every 2 minutes when the app is hidden, instead of every 5 minutes. The account (Premium and coins) check runs every 10 minutes instead of 5. At 100,000 open apps that is about 14,000 fewer function calls and database writes a minute.
- 2 new tests, 1 updated. Docs: `docs/PERFORMANCE.md` has a "Large traffic" section. Service worker cache v22.
- Not changed: Supabase limits (sign-in and favourites go straight from the browser to Supabase, so check your Supabase plan's connection and auth limits before a big launch), and Vercel plan limits. Both are plan settings, not code.

# Changes in 0.37.1 — real player photos on the lineups

- **Why the numbered shirts never turned into photos:** the photo was added hidden and set to load lazily; browsers don't fetch a lazy image that isn't displayed, so the photo never loaded and the shirt stayed. It now loads straight away and swaps in as soon as it arrives. If a player has no picture (or the phone is offline) the numbered shirt stays, so nobody is ever blank.
- **Every phone gets the faces.** Phones with very little memory used to skip them (the "lighter mode" gate); player photos are tiny, so that gate is gone for the lineup.
- **Substitutes show faces too**, with the shirt number as a small badge on the photo.
- 3 new tests in `tests/lineup-photos.test.mjs`. Service worker cache v21.

# Changes in 0.37.0 — plainer copy, tidier SEO text

- **Rewrote the text that read like generated marketing**, in the app, the page descriptions search engines show, the link previews and the About page. Examples: "Football intelligence, built for clarity" is now "Football scores and predictions."; "Sharper signals. Less noise." is "Today's predictions"; "See the full signal" is "Unlock every prediction."; "your livescore hub" and "from every major competition" are gone; "signal", "match intelligence" and "one tap away" are replaced by what the thing actually is. Prediction pages and match pages now describe what is on them and how predictions are checked, instead of "follow every score as it happens".
- **A wrong Help Centre answer is fixed.** It said predictions come from API-Football and that Scoutwave doesn't publish tracked results; both are untrue (the model is Scoutwave's own and results are tracked).
- **Removed the keyword list** (`meta keywords`). Google has ignored it for years and a long list of search terms reads as keyword stuffing. Titles and descriptions are unchanged where they already named what the page is.
- A test now fails if the filler phrases come back.
- Not touched on purpose: the Privacy Policy and Terms (legal wording), and the Premium/coin product names.
- Service worker cache v20.

# Changes in 0.36.0 — fewer football API requests, one font on every phone

- **Fonts.** The loading screen used a different font list from the app (it named "SF Pro Text"), so the text changed font the moment the app appeared. Both now use one identical list, with the phone's own system font first (Apple fonts on iPhone, the phone's chosen font on Android, Roboto where a browser can't name it). The Apple-only "SF Pro" names are gone. Android Chrome and Samsung Internet also enlarge some text blocks on their own ("font boosting") so that text in different cards ended up different sizes; that is now switched off with `text-size-adjust`.
- **Time zone no longer splits the shared cache.** Every request carried the visitor's time zone, so the same match, club or league list was cached and fetched from the provider once per time zone. Only the by-date list (where it decides which matches belong to the local day) keeps it; match, club, venue, league, form and head-to-head requests are now identical for everyone. Every screen reads times with `new Date(...)`, which understands the offset, so nothing displays differently. Biggest effect: popular live matches, which are polled every minute.
- **Pull-to-refresh forgets live data only** (scores, events, lineups, statistics, odds, tables). It used to wipe everything, so pulling on a player or club page re-spent a dozen requests on players, squads, trophies, leagues and teams that cannot have changed.
- **Player pages:** before July the app asked for this calendar year's season first and almost always got nothing, then asked again. It now asks for last year's season first in that part of the year (one request instead of two for most players).
- The startup budget (180 KB) still holds. 4 new tests in `tests/api-usage.test.mjs`. Service worker cache v19.
- Not changed, worth knowing: the by-date list is still cached per time zone (it has to be); Admin > Usage will show the hit rate improving after deployment.

# Changes in 0.35.0 — SEO for livescores and predictions

- **Pages for the two searches that matter.** `/livescores` and `/predictions`, plus one page per day (`/livescores/2026-10-29`, `/predictions/2026-10-29`, from 30 days back to 14 ahead). Search engines get the full list of matches by competition, each linked to its match page, with a plain summary, previous/next-day links, breadcrumbs and an ItemList. Dates outside the window are a real 404.
- **Predictions pages show the model's confidence by default, not the pick** (the pick is what Premium sells). `SEO_SHOW_PICKS=1` also names the likeliest result. Read from the stored predictions, so no extra football API requests beyond one fixtures call per day.
- **Match pages for upcoming games read as prediction pages** (title "X vs Y Prediction, Kick-off Time & Lineups", a prediction section, links to that day's pages).
- **`/vip` moves permanently to `/predictions` for search engines**, so one address collects the ranking. The app keeps `/vip`.
- **The app opens the same addresses.** `/livescores[/date]` shows Home on that day; `/predictions` shows the predictions screen. A visitor arriving from a search result lands where the result promised.
- **Sitemap:** new `sitemap-days.xml`; fixed pages list the new addresses; match sitemap now covers four days (yesterday to day after tomorrow). `llms.txt` and the crawler navigation link to the new pages.
- **Link previews** use a 1200 x 630 image (`icons/og-image.png`) instead of the square icon, so shares on WhatsApp, X and Telegram show a large card.
- Startup code stayed under its 180 KB budget: helpers only search engines need live in `seoEntities.js` (not downloaded by the app); `breadcrumbs` moved there too.
- Service worker cache is now v18. 9 new tests in `tests/seo.test.mjs` (one of them caught a title that was cut off mid-brand).
- Not done here, needs your Search Console: submit `/sitemap.xml`, and set `SITE_URL` to your https address.

# Changes in 0.34.1 — touch targets

- **Small buttons were hard to hit.** The header icons (38 points), icon buttons (36), the #tag chips on News (about 34), the hashtag chips inside news cards (about 20) and the red substitution arrow on the lineup pitch (15) were all under the 44-point size Apple recommends. The look is unchanged; each now has an invisible padding that brings the tappable area to about 44.
- A code audit also checked: timers and listeners are cleaned up when a screen goes away, every CSS variable is defined or has a fallback, keyboard focus outlines exist, and no raw HTML is built from outside text. Nothing else was found by reading the code alone; layout problems that only show on a screen need a screenshot to find.

# Changes in 0.34.0 — lineup photos, and nothing technical shown to the public

- **Lineups show player photos.** On the pitch, each starter is now their face in a ring instead of a coloured shirt icon, with the shirt number as a small chip on the corner (goal, card and substitution badges and the rating pill stay). The photo comes from the provider's fixed player-photo address by player id (a rated player's own photo is used when we have it). Until the photo loads, or if it can't (no photo, slow or low-memory phone with photos off, offline) the numbered shirt shows exactly as before, so nobody is ever blank.
- **No error or message names the technology or points at setup.** Before, a visitor could be told things like "Set NEWS_ACCESS in the Vercel project environment variables", "The admin area is not set up yet. See docs/ADMIN.md", "Football data request failed (HTTP 502)" or "Unsupported parameter: x". Now:
  - Every public response says only what a person needs ("News is unavailable right now.", "Bad request.", "Sign-in is unavailable right now."). The real reason is written to the server log (Vercel > Logs) so it can still be found.
  - New `src/utils/errors.js`: every place that shows a caught error on screen goes through `safeMessage()`, which replaces anything technical (browser errors like "Cannot read properties of undefined", status codes, service or setting names, database wording) with a plain sentence. The real message still goes to the browser console.
  - Sign-in errors, football data, news, feedback and checkout errors no longer pass raw service text or status numbers through. The start-up failure screen no longer mentions JavaScript.
  - The admin sign-in page and the admin script no longer mention docs files, Vercel, Supabase or migration file names.
- **The site no longer hands out its own project files.** `README.md`, `CHANGES.md`, `package.json`, `vercel.json`, `docs/`, `supabase/`, `server/`, `tests/` and `scripts/` sat in the site root and could be downloaded by anyone who guessed the address. They now redirect to the home page. (`src/` still has to be public: it is the app.)
- Still shown, to a signed-in administrator only: the setup checklist inside the admin dashboard (it comes from the server after login and names the settings you need to fix).
- Not changed on purpose: the Privacy Policy still names the services that handle personal data (it is a legal requirement to say who processes it), and the Help Centre answer about where match data comes from.
- Tests: `tests/errors.test.mjs` fails if a server message or screen text names a technology or a setup step, if a caught error is shown without the filter, or if a project file becomes downloadable again.

# Changes in 0.33.2 — news page fixes

- **Coming back from a story lost your place.** After scrolling through several pages and opening a story, going back showed page 1 at the top. The news list now remembers how many pages you had read and where you were (for as long as the pages stay cached, 15 minutes), rebuilds them instantly and scrolls back. Tapping a #tag chip doesn't count as opening a story.
- **A tag from the address wasn't scrolled into view.** Opening `/news?tag=bayern` highlighted the chip but left it off-screen in the row. The row now centres the active chip itself once the screen is on the page, and no longer risks scrolling the whole page.
- **Paging could loop.** If the provider repeated stories it had already sent, "Load more" kept fetching page after page (each one a news API request). It now stops at the first page with nothing new, and only one page loads at a time (the scroll trigger, the button and "Try again" could previously overlap).
- **"Transfers" tag matched the wrong stories** ("design", "assigning" and similar). It now matches whole words only.
- **Times were rounded up** ("3.6 hours" showed "4 h ago", "1.6 days" showed "2 d ago"). They now count whole minutes, hours and days.
- **Less storage work:** a story already remembered is no longer written to session storage again on every render.
- Tests: `tests/news.test.mjs` (times and tags). The scroll and paging behaviour needs a phone to check; I couldn't run a browser here.

# Changes in 0.33.1 — one font everywhere (fixes mixed fonts on a return visit)

- **Bug:** the first visit showed the phone's own font, but on a return visit text could appear in a mix of the phone's font and DM Sans. The font stack listed DM Sans, which was downloaded after the page loaded (and skipped on some phones), then served from the browser's cache on later visits, so which font a piece of text got depended on timing and on the device.
- **Fix:** the app now uses the phone's own font only (San Francisco on iPhone, Roboto on Android) and loads no web font, so every screen looks the same on every visit. This also removes two network requests and the late font swap.
- Share images still use DM Sans (the card is a picture, so it looks the same on every phone); that font is only fetched when someone exports a card.
- The service worker cache is bumped (v17) so old cached font files and styles are dropped.
- Test: `tests/startup.test.mjs` fails if a web font returns to the page or the stack, or if any style sets its own font-family.

# Changes in 0.33.0 — scheduled jobs share fetched data between runs (optional migration)

- **Snapshot cache in Supabase (`api_cache`, migration `009_api_cache.sql`).** The prediction jobs now keep a compact copy of each competition's table and each season's finished matches for 3 hours (`PREDICT_CACHE_MINUTES`, 0 = off). A later run (the next cron, "Record predictions now", a different model) reads it instead of paying the football API again. Only what the models read is stored (about a quarter of the raw size).
- **Optional.** Without the migration, or if Supabase hiccups, the jobs fetch exactly as before. Run `009_api_cache.sql` in the SQL editor to switch it on (also appended to `all_migrations.sql`).
- Layers now: memory inside a running function (10 minutes), then the snapshot (3 hours), then the football API. The day's not-started list and grading lookups are never cached.
- 1 new test.

# Changes in 0.32.0 — fewer football API calls: smarter shared cache

The app already cached in three layers on the phone (memory, tab, long-term for venues and players). The gap was the **shared cache at Vercel's edge**, which serves every visitor at once and used one fixed lifetime per endpoint. It now decides from the answer itself (`ttlFor` in `api/football.js`):

- **Match lists:** anything live stays 30 s. A day where nothing has started waits a quarter of the time to the next kick-off (2 to 10 minutes; 30 s in the last 10 minutes). Matches long over are kept for a day (6 h for team lists), just finished ones 10 minutes. Before, everything not finished was 30 s.
- **Match details of a finished match** (events, line-ups, stats, players): 30 minutes instead of 30 seconds, when the app says the match ended more than 3 hours ago (`settled=1`, a hint that is never forwarded to the provider and capped at 30 minutes so it can't keep live data).
- **Tables:** 10 minutes while matches are being played, up to an hour once the table has been quiet for a day, a week for a finished season.
- **Slow data:** leagues, teams, coaches and trophies 3 days (were 1); head-to-head and rounds 12 hours (were 6).
- **Rate limit hit:** the edge now answers "limit reached" for a minute instead of every visitor calling the provider again.
- **Scheduled jobs:** a season's table and finished matches are remembered for 10 minutes inside a running function (`PREDICT_MEMO_SECONDS`, 0 = off), so pressing "Record predictions now" twice doesn't pay twice. They don't count against the call budget.
- Nothing is cached longer than the data allows, and live answers are unchanged. Not measured on real traffic: watch the edge hit rate in Admin > Usage after deploying.
- New: `tests/football-cache.test.mjs` (8 tests).

# Changes in 0.31.0 — ratings model `ratings-v3`, recorded beside the others (not shown in the app)

- **Team ratings fitted from match results.** All finished matches this season are used, newest weighted most (half-life about 150 days). Attack, defence and home advantage are fitted together, so scoring against a strong defence counts for more than against a weak one, which a league table can't see. Records with few games are pulled toward average. Scorelines, draw calibration and outputs reuse `poisson-v2`.
- **Shadow only.** It is recorded before kick-off and graded like the others, and appears in Admin > Predictions as "poisson-v2 vs ratings-v3". The app never shows it; it would only replace v2 after winning that comparison.
- **Cost: one extra football API call per competition** per run (finished fixtures for the season), only when something still needs it and budget is left (`PREDICT_MAX_CALLS` / `PREDICT_QUOTA_SHARE` still apply). Set `PREDICT_RATINGS=0` to switch it off. With the default 40-call cap, fewer competitions fit per run: raise `PREDICT_MAX_CALLS` if you want the same coverage.
- Needs about 20 finished matches in the competition and 3 per team, so it skips the first weeks of a season.
- On synthetic leagues the gain over v2 is small (table and ratings agree when schedules are balanced); real gains would come from uneven schedules and changing form, which only the comparison on real matches can show.
- New: `src/predictions/ratings.js` (server-only). 2 new tests.

# Changes in 0.30.0 — prediction model upgrade (poisson-v2), with the old model kept running for comparison

- **New model, `poisson-v2`.** Same inputs as before (the league table and the last five results), so it costs **no extra football API requests**. What changed:
  - **A team's overall record comes first, its home/away split second.** Eight home games say little on their own; sixteen games say more. A lopsided split (say 3.0 goals a game at home, 0.8 away) is now only partly believed.
  - **How hard records are pulled toward the league average is measured from the table**, not a fixed "6 average games": a league of near-equals is pulled harder than one with a clear top and bottom, and a record with few games behind it is pulled harder still.
  - **Draws follow the competition.** The chance of a level score for an average match is lined up with the league's real draw share (itself pulled toward 26%).
  - **Form is judged against the team's own season.** A strong side winning is normal, not "hot form"; only results better or worse than its usual points per game move the numbers (at most 5% on its own expected goals, 2.5% the other way on its opponent's). Before, raw points counted, so good teams were credited twice.
  - **Confidence needs enough games** (5 for "medium" or better, 8 for "high"), not only a big percentage.
  - **League scoring averages are blended with typical values for the first ~10 games**, so matchday 1 can't swing the baseline.
- **`poisson-v1` is frozen and keeps running.** The scheduled job now records both models for every match, before kick-off, from the same table (still one `standings` call per competition). The app shows one pick per match: the **earliest recorded**, so a pick someone has already seen never changes because the model was upgraded; for new matches that is `poisson-v2`.
- **Admin > Predictions has a new card, "poisson-v2 vs poisson-v1"**, scored on the matches both predicted (log loss, Brier, winner, over/under, both teams score, exact score, top 3/5). Judge by log loss over a few hundred matches.
- **Grading writes ten rows at a time** instead of one by one, because each match now has two rows.
- **What this does not do:** the gain is **not yet measured on real matches**. On synthetic leagues with known strengths v2 beat v1 at every stage of a season (a repeatable check is in `tests/predictions.test.mjs`); real football has things a table can't see, so the admin comparison is the verdict. The public accuracy figure (needs 200 graded matches) now counts `poisson-v2` only, so it starts again from zero.
- Nothing to run in Supabase: the table already keeps one row per match and model (`004_predictions.sql`). New: `api/_models.js` (which models are recorded), `src/predictions/poisson-v1.js` (frozen, server-only: the app doesn't download it). 11 new tests.

# Changes in 0.29.2 — more design fixes

- **Dark mode: sign-in and sign-up fields had no visible box.** They used the same black as the page. They now use the card grey.
- **Lineup pitch: rating chips no longer cover the first letters of player names.**
- **Match header on small phones (320 px):** the score no longer collides with the crests, and scorer names wrap inside their own half instead of running off the screen.
- **League position** now shows as a small "#1" chip on the crest's corner instead of "[1]" squeezed between the crest and the score.

# Changes in 0.29.1 — font consistency, design and bug fixes

- **Shared images no longer fall back to a serif.** Share cards were drawn in "DM Sans" with no fallback, so on phones where the web font is skipped (1 GB tier, data saver) or hadn't loaded yet, the browser's default font (often a serif) was used. Cards now have a sans-serif fallback stack, and exporting a card loads DM Sans first if the page hasn't.
- **Boot screen matches the app.** The loading/error screen used Arial and then jumped to the app's font; it now uses the same system stack.
- **Weight 800 removed.** Only 400-700 of DM Sans are loaded, so 800 looked heavier on Apple devices (real SF 800) than on Android/Windows (clamped to 700). The six uses are now 700 everywhere.
- **Report an issue and Contact us showed a stray "null".** The support form passed empty slots to the browser's native `append()`, which prints them as text. Empty slots are now dropped first.
- **Pages no longer scroll when they are short.** `100vh` is taller than the visible screen on phones (address bar, toolbars), so every page could be nudged up and down. Screens now use `100dvh` where supported.
- **Match header stars match the rest of the app.** The favourite star in the match header is now the same circle as the share button, grey when off and amber when on (as in the match list); the stars beside the crests follow the same colours.
- **Predictions: matches past the 60th in one request were never asked for.** The app asks the server for picks in batches, and the server answers at most 60, but the app remembered every match it had queued as "no pick". It now asks in chunks of 60.
- **Predictions: a league table row without a home/away split crashed the "why" figures.** The per-game numbers now cope with missing splits (and have tests).
- **Leagues can recover from a failed load** with a Try again button, like the Games list.
- **Spacing and text fixes:** lists directly under a page header (Appearance, Language and others) had no gap above them; a gap before the full stop in "Privacy Policy." on the sign-in screen; the search box placeholder was cut off on phones and now reads "Search football…".

# Changes in 0.29.0 — match header: follow clubs and league positions; club page touches

- **Follow a club from the match header.** A star now sits beside each club's crest (the same favourite the club page uses; tapping it doesn't leave the match).
- **League position beside each crest**, like "[2]" in your screenshot: where each club stands in that competition's table (Champions League league phase included). Competitions without a table show nothing. One table request, shared with the app's cache.
- **Club page.** The standings slice now has the Goals column (goals scored) from your screenshot, and Top performers has "See all players", which opens the Squad tab.
- **Already in place from earlier versions** (your screenshots 2 and 3): the last-5 results card, top performers, the standings slice, history rankings, and five form chips directly under the club crest and under both club names in the match header.
- **Not built: squad value ("1B€").** The football data provider doesn't supply squad market values; they come from other sources (such as Transfermarkt) that need a separate licence. Showing a made-up number would be wrong, so it is left out.
- New check: `tests/imports.test.mjs` finds a function that is called but never imported (a mistake a syntax check can't see; I made one while building this). Suite: 117 tests.

# Changes in 0.28.0 — faster startup, faster lists, fewer round trips

- **Icons are parsed once.** A busy match day draws 500+ star icons; each used to re-parse the same markup. Now one parse per icon, then copies (a test proves 500 stars cost one parse).
- **Fonts don't hold up the first paint.** The DM Sans stylesheet was a render-blocking request to another site; it now loads after the page, is skipped on 1 GB phones and with data saver (they use the system font), and the unused Space Mono request is gone. On Android and Windows text may show in the system font for a moment before switching.
- **Animated themes load on demand.** Only someone who has switched a theme on downloads the animation code (9 KB); the theme list and unlock rules stay small and available at startup.
- **Fewer round trips on repeat visits.** App code is reused for 5 minutes (refreshed in the background for a day) and images and icons for a week, instead of being re-checked on every launch (about 40 requests). Pages, the API, the service worker and the admin stay fresh; a new release can take up to about 5 minutes longer to reach someone who already has the app open.
- **Startup code:** 220 KB in 41 files at the start of this round of work, 175 KB in 37 now (gestures, push, usage reporting, prediction code, server-only SEO code and theme animation load when needed).
- **Budget test.** `tests/startup.test.mjs` (8 tests; the suite is 113) fails if startup code grows past 180 KB or 40 files, if a deferred module is imported at startup again, if a blocking third-party stylesheet returns, or if a cache rule would make pages or the API stale.
- Measured by file size and by test; not timed on a real phone. See the end of `docs/PERFORMANCE.md`.

# Changes in 0.27.2 — makes the function-limit fix survive an upgrade from a zip, and a lighter startup

- **Why the deployment could still fail after 0.27.1:** copying a new version over an old project never deletes the files that were removed. The 16 old endpoint files that moved from `api/` to `server/` stay behind and still count as serverless functions (22 in total, limit 12). A copy of the project with 7 of them left over counts 15, and the deployment fails exactly as before.
- **Fix it in one command:** `node scripts/clean-stale-functions.mjs` removes the old copies (only when the same handler exists in `server/`), then prints the 8 functions that should remain. `npm test` now fails with the list of old files if any are left, a `.vercelignore` makes command-line deploys skip them, and `docs/DEPLOY.md` has the exact steps including committing the deletions.
- **Lighter startup:** pull to refresh, push settings, usage reporting and the prediction tracker load when the browser is idle instead of before the first screen, and the server-only SEO code (page auditor, club/player/stadium data builders) is no longer downloaded by the app. Startup code: 220 KB in 41 files before, 185 KB in 37 now.
- The suite is 105 tests (the deployment test also guards against leftover files).

# Changes in 0.27.1 — fixes the failed deployment (12-function limit)

- **The deployment failed** because Vercel's free (Hobby) plan allows 12 serverless functions and the project had 22 (every file in `api/` counts as one). It is now **8**.
- **How:** the handlers for the small endpoints moved to `server/`, and three entry points (`api/public.js`, `api/account.js`, `api/seo.js`) call them. **Every address is unchanged** (`/api/config`, `/api/me`, `/api/predictions`, `/sitemap.xml`, `/feed.xml`, `/robots.txt`, `/llms.txt` ...): `vercel.json` rewrites them to the entry points, so the app, the admin, the search engines, the cron jobs, the Polar webhook and the browser's policy reports all work as before. The payment webhook stays its own function (it needs the raw request body).
- **It can't happen again silently.** New `tests/deploy.test.mjs` (7 tests; the suite is 105) fails if there are more than 10 functions, if an address the app calls has nothing behind it, if a rewrite points at a missing route, or if a module no longer loads after a move. `docs/DEPLOY.md` explains the layout and how to add an endpoint.
- Nothing to run in Supabase and no new settings. Redeploy.

# Changes in 0.27.0 — placement analytics and scheduling

- **See what your ad and promotion spaces earn.** Views, taps and tap rate per day, per space and per campaign for the last 30 days, on the new admin **Placements** page. A view is counted after half of the space has been on screen for a second (once per visit); a tap when it is tapped.
- **Run dates.** Each space can start and end on a date you choose; outside them it disappears with no gap. The admin shows Live, Starts, Ended or Off.
- **Campaigns.** Changing a space's headline or link starts a new campaign with its own figures; reword the text or button and the figures stay together.
- **Private by design.** Counts only: no person, device, address or cookie is stored, and visitors who send Do Not Track or Global Privacy Control are not counted. Events for a space that is off, out of dates or stale are ignored, bots are ignored, each address is limited, and switching a space off takes effect immediately.
- New: `supabase/migrations/007_placement_stats.sql`, `api/placement-event.js`, `src/placements.js`, `src/placementTracker.js`, `tests/placements.test.mjs` (9 tests; the suite is 98). `docs/NEWS.md` explains the counting and its limits.
- **Before you deploy:** run migration 007, then redeploy. Update your privacy policy to mention that promotion views and taps are counted anonymously.

# Changes in 0.26.0 — advanced SEO

- **Club, player and stadium pages are now prerendered for search engines.** They were the biggest gap: crawlers got only a title made from the address. Each now has real facts, results and fixtures, links, a unique description and structured data (SportsTeam, Person, StadiumOrArena, BreadcrumbList); leagues get an ItemList of the table; matches get an end time and image.
- **Real 404s and one address per thing.** Unknown addresses and unknown ids answer a genuine, non-indexed 404 (before, every address returned 200). Wrong or missing words (`/club/33`, `/club/33-wrong`) 301-redirect to the correct address; trailing slashes redirect.
- **Sitemap index** of small sitemaps (pages, leagues, matches, news, optional clubs) with real dates only; an **RSS feed** at `/feed.xml`; a **llms.txt**; a **robots.txt** with a one-setting AI crawler policy; `noindex` on API answers; more crawler and link-preview names recognised (Reddit, Mastodon, Viber, Skype, Embedly, AI search crawlers and more).
- **Football API budget for crawlers.** A daily cap (400 requests, `SEO_MAX_CALLS_PER_DAY`) so a crawl can't use the quota; pages are cached for hours and degrade gracefully past the cap.
- **Link previews:** the crest, player photo or stadium image is the preview picture, plus locale, image alt text, optional X handle, and Search Console / Bing verification tags.
- **admin > SEO:** setup checklist and a page auditor that shows each page as a search engine receives it and lists problems (titles, descriptions, canonical, accidental noindex, headings, structured data, thin content). Overview gets an SEO health check.
- New: `api/_seoPages.js`, `api/feed.js`, `api/llms.js`, `tests/seo.test.mjs` (18 tests; the suite is 89), `docs/SEO.md` with the setup steps and the honest limits.
- Needs from you: set `SITE_URL`, add the Search Console tag (`GOOGLE_SITE_VERIFICATION`), redeploy, submit `/sitemap.xml`. Nothing to run in Supabase.

# Changes in 0.25.1 — readability, layout and a regression fix

- **Fixed a regression from 0.24.0:** a style rule added for the club chips recoloured *every* form chip in the app (match header, fixture rows). Removed; the new colours are scoped to the club cards only.
- **Readable result colours.** White text on the old win, draw and loss colours measured 2.2:1, 3.3:1 and 3.6:1 (4.5:1 is the minimum for small text). The club cards (last 5, form chips, top performers) now use deeper colours at 5.1 to 5.6:1; the position-history line is darker on light backgrounds and its labels use normal text colour. All base text colours were measured and already pass.
- **Narrow phones (320 px).** The last-5 score badges were wider than their columns and would overlap; they now fit, the row adapts when fewer than five matches exist, and a few sizes shrink slightly on very narrow screens.
- **Bigger tap areas.** Round icon buttons (close, share) now have a 44-point hit area without changing how they look.
- **Under the hood:** `h()` now applies CSS custom properties from style objects (they were silently ignored). A static check found every icon-only button named, every image with alt text and every form field labelled (the one exception is a hidden spam trap).
- New: `tests/design.test.mjs` (7 tests) guards contrast, undefined theme variables, stray global overrides, tap areas and reduced motion; the suite is now 71.

# Changes in 0.25.0 — private Premium picks, and polish

- **Premium picks are private.** With accounts switched on, the server now decides who may see a stored pick: signed-in Premium members, or people who unlocked that match with coins. Everyone else gets a teaser (confidence and rank) and nothing else: no pick, probabilities, score, expected goals, reasoning or note. Fails closed on a bad token, a suspended account or a sign-in outage; answers are never cached between people. Before this, the feed only *hid* locked picks on screen and the match page showed them to everyone.
- **Unlock where you see the lock.** Locked picks (feed and match page) now show Get Premium, Unlock for N coins (the server charges and decides the balance), or Sign in to unlock. The screen refreshes with the pick as soon as it is unlocked. The app no longer computes a pick on the device for someone who hasn't unlocked it.
- **Polish.** The five form chips sit directly under the club crest; the last-five card has a skeleton of the same shape so the page doesn't jump; clear keyboard focus rings everywhere; drawers respect phone gesture bars and use the visible screen height; steadier image placeholders.
- New: `src/components/PredictionLock.js`, `tests/premium-gate.test.mjs` (9 tests; the suite is 64). `docs/PREDICTIONS.md` has the rule and its honest limit (the model code itself is in the app).
- Nothing new to run in Supabase. Turn on *Account Premium and coins* in admin to enforce it.

# Changes in 0.24.0 — club page upgrade and a much lighter app for 1 GB phones

- **Club page, from your screenshots.** Five W/D/L chips now sit **under the club crest**. The Overview has a **Last 5 matches** card (opponent crest over the score as played, coloured green, grey or red for the club's result; tap for the match), **Top performers** (top scorer with penalties in brackets, most assists, best average rating), a **Standings** card (three rows around the club, club highlighted, "Full table") and **History rankings** (league position by season as a line chart). History is loaded only when you tap it (up to 9 lookups, run once, saved on the device because a past table never changes). Past seasons get the same cards for that season.
- **1 GB phones.** A new lightest tier (see `docs/PERFORMANCE.md`): no animations, smaller caches, no decorative photos, share pictures at half size, slower background refresh.
- **Faster and lighter for everyone.** One screen rebuild per tap instead of several; long match lists are drawn in pieces; off-screen rows are skipped by the browser; image assets shrank from 523 KB to 91 KB (two unused logos removed, wordmarks and avatars resized, avatars now WebP).
- New: `src/clubStats.js`, `src/components/ClubInsights.js`, `src/utils/chunked.js`, `tests/club.test.mjs` (7 tests; the suite is now 55).
- Top performers use the provider's first page of players (20) for the season. History rankings count against the football API quota once per club and season, then never again.
- Not measured on a real 1 GB phone: see the last section of `docs/PERFORMANCE.md`.

# Changes in 0.23.0 — draggable drawers, richer sharing, news on our own URL, tighter security

- **Draggable drawers.** Every bottom drawer (the share sheet today) now follows your finger: drag it by the handle or header, or pull down on the content when it is scrolled to the top. It closes on a long drag or a quick flick and springs back otherwise; the backdrop fades as it moves. Also closes on Escape, a tap outside, the Close button and the phone's Back button, keeps keyboard focus inside, and respects "reduce motion". One reusable component (`src/components/Sheet.js`).
- **Share is data-rich.** The match picture now carries recent form for both teams, half-time score, the scorers with minutes (own goals and penalties marked) and the referee, from data the match page already has (no extra requests). Sharing sends a caption and a link to our page for it (which previews with the live score), and the drawer has Copy link.
- **News polish and our own URLs.** Stories open at `/news/<words>-<id>` with a summary page, a "Read the full story" button to the publisher, More stories, share, and page titles / previews for search engines. The list is tidier (source badges, larger thumbnails, three-line headlines), keeps loading as you scroll, and links inside the app no longer reload the page. See `docs/NEWS.md`.
- **Placements.** Four labelled spaces for an ad or promotion (in the news list and at the top, middle and end of a story), managed from admin > Remote config with safe-link validation. Off until you fill them in.
- **Security (SQL injection and XSS).** No exploitable injection was found, and it is now structurally impossible: one helper (`api/_query.js`) for every database value, enforced by a test that fails if any file does otherwise. New Content-Security-Policy and security headers for the whole app, URL-scheme protection for every link and image (`javascript:` and friends can't run), cleaned news data, inline scripts moved out of `index.html`. Violation counts appear on admin > Security. See `docs/SECURITY.md`.
- New: 47 automated tests (`npm test`). A bug that one of them caught in this release's own refactor was fixed before shipping.
- **Before you deploy:** nothing new to run in Supabase. After deploying, open the app and click through the main screens, then check admin > Security for "Nothing blocked" (details in `docs/SECURITY.md`). Redeploy so the new headers apply.

# Changes in 0.22.0 — three layers of security for the admin sign-in

1. **Required two-factor, every code works once.** The authenticator code can no longer be skipped (before, leaving `ADMIN_TOTP_SECRET` unset turned it off), and a code that has been used is refused, so a seen code can't be replayed.
2. **Lockout that survives restarts.** Failed attempts are stored in the database (the old counter lived in a server's memory and reset on every new instance). 5 failures lock an address for 15 minutes, doubling each time; 20 failures from anywhere in an hour lock sign-in for 15 minutes, so spreading guesses over many addresses doesn't help.
3. **Server-side sessions you can see and end.** Idle timeout (30 min, `ADMIN_IDLE_MINUTES`), tied to the browser that signed in (optionally the network: `ADMIN_BIND_IP=1`), listed and revocable on the new **Security** page, with *Sign out everywhere*. Signing out now ends the session on the server. Failed sign-ins, locks, reused codes and rejected sessions appear in the audit log and on the Security page.
- New: `supabase/migrations/006_admin_security.sql`, `api/_adminsec.js`, `tests/admin-security.test.mjs`, an "Admin sign-in protection" health check, `docs/ADMIN.md` rewritten security section.
- **Before you deploy:** `ADMIN_TOTP_SECRET` must be set in Vercel or you won't be able to sign in (run `node scripts/admin-setup.mjs` if you don't have one). Run migration 006 as well; until then sign-in works with reduced protection and a warning.

# Changes in 0.21.0 — push notifications and admin usage charts

- **Push notifications.** People can turn on alerts for goals, kick-offs, half-time and full-time for matches and clubs they have starred, delivered when the app is closed (Profile > Notifications). Follows the existing Kickoff, Goal and Whistle switches. On iPhone it needs the app on the Home Screen. The server job sends only changes, never repeats an alert, removes dead devices, and stops when less than 25% of the day's football API quota is left.
- **Admin > Usage.** Football API requests per day (app, prediction jobs, push), busiest endpoints, today's quota, cache hit rate on the device and (estimated) at the shared edge cache, and alerts sent per day. The app now reports cache counters (totals only).
- New: `supabase/migrations/005_usage_and_push.sql`, `api/push.js`, `api/usage.js`, `scripts/generate-vapid.mjs`, `docs/NOTIFICATIONS.md`, `tests/push.test.mjs`, a `web-push` dependency, and a "Push notifications" health check.
- Needs from you: run migration 005, generate and set the three VAPID keys, and schedule `/api/cron?task=push` every minute (Vercel Pro cron or a free outside scheduler; Hobby can't). Full steps in `docs/NOTIFICATIONS.md`.

# Changes in 0.20.0 — server-side prediction tracking (switched off until you set it up)

- **Scheduled jobs** record a prediction for every upcoming match before kick-off and grade it after the match, so tracked accuracy covers all matches. The first prediction per match is final. Costs a capped share of the football API quota (default at most 40 calls and 35% of what is left that day).
- **The app shows the stored prediction** (one batched request) and falls back to the on-device model if the server has none. The VIP tab shows the server-tracked accuracy once 200 matches are graded (`PREDICT_MIN_PUBLISH`).
- **Admin > Predictions:** headline accuracy, Brier score, log loss, exact score and top-3/top-5 coverage, calibration tables, run-now buttons, and a like-for-like comparison with the bookmaker market and with Forebet (typed in by hand before kick-off; never scraped).
- **Optional:** bookmaker odds for benchmark, edge and quarter-Kelly (admin only, never shown to users); OpenAI writes a short plain-language note per match and never changes a probability.
- New: `supabase/migrations/004_predictions.sql`, `api/cron.js`, `api/predictions.js`, `api/accuracy.js`, `src/predictions/metrics.js`, `tests/predictions.test.mjs` (`npm test`), a health check in Admin > Overview, new variables in `.env.example`. `docs/PREDICTIONS.md` says exactly what is built and what is not.
- Needs from you: run migration 004, set `CRON_SECRET` in Vercel, redeploy.

# Changes in 0.19.0 — buying Premium and coins with Polar

- **Real checkout.** With *Account Premium and coins* on, signed-in users who choose a Premium plan or a coin pack are sent to Polar's hosted checkout. Back in the app it confirms the payment and updates the balance (the webhook can take a few seconds). Guests and the flag-off state keep the prototype.
- **Server decides.** `POST /api/checkout` creates the Polar checkout for the signed-in account; `POST /api/polar-webhook` verifies Polar's signature, then adds Premium days or coins based on the Polar *product id*. Each order is recorded once (`payment_events`), so repeats never double-grant; refunds take the purchase back; every coin movement is in the ledger.
- New: `supabase/migrations/003_payments.sql`, `docs/PAYMENTS.md` (setup, in sandbox first), Polar environment variables in `.env.example`, and a "Payments (Polar)" health check in Admin > Overview.
- Premium is added as time (1 month = 30 days, 12 months = 365 days) and stacks on an existing end date.
- Needs from you: the Polar access token, webhook secret and six product ids (see `docs/PAYMENTS.md`). Until they're set, buying shows "Payments are not set up yet." and nothing else changes.

# Changes in 0.18.0 — Premium and coins on the account (admin-managed)

- **New, off by default:** a Remote config flag, *Account Premium and coins*. When on, signed-in users' Premium, coins and unlocked themes/tips come from the database and follow them to any device. Guests keep the local demo. Nothing changes for anyone until you switch it on.
- **Server-authoritative.** Prices and balances are decided on the server; the app only asks. A purchase is charged exactly once (double taps, two devices at once), never takes a balance below zero, and every coin movement is recorded in a ledger. Editing the phone's storage can't create Premium or coins (the next sync restores the real values). Signing out clears them from the device.
- **Admin:** Users now shows Premium (with end date) and coins, with a *Premium & coins* dialog: grant 7/30/90/365 days or permanent, revoke, add or remove coins. A reason is required and goes to the audit log and the ledger. New setting: the coin cost of unlocking a tip. Overview has a health check for the new table.
- New endpoints `GET /api/me` and `POST /api/spend`; migration `supabase/migrations/002_entitlements.sql` (RLS on, no client access).
- **Not included (needs a payment provider):** buying Premium or coins inside the app. With the flag on, signed-in users see that purchases aren't open yet; the admin can add Premium/coins by hand. `docs/ADMIN.md` describes how a payment webhook would plug in.

# Changes in 0.17.0 — low-end phones, and the admin dashboard at /mingt-t

## Faster on 2 GB Android phones
- **Lighter mode**, automatic on phones that report 2 GB of memory or less (or data saver / a slow connection), and switchable in Appearance (Automatic / Lighter mode / Full effects). It is decided before the first paint. It removes backdrop blur (the costliest effect for a phone GPU), the animated theme weather and glow, skeleton shimmer and most shadows, keeps smaller in-memory and stored caches, and refreshes live scores 50% less often. Themes keep their colours.
- **Measured** (fire theme, phone-class CPU at 4x slowdown, scrolling the Games list): compositor layers 45 down to 15, and the snow theme from 106 layers to 15, with roughly 4-5x less rendering work in lighter mode. A normal screen is about 11-15 layers.
- For everyone: off-screen list items (match groups, news, search results) are skipped by the browser until needed (`content-visibility`), and particles no longer force their own GPU layers.

## Admin dashboard at `/mingt-t`
- Overview (health, users, inbox, football API quota), **remote config** (predictions flag, advanced-themes kill switch, maintenance mode, announcement banner, minimum app version, theme prices), message inbox, users (ban/unban), audit log. See `docs/ADMIN.md` for setup (a SQL migration, `node scripts/admin-setup.mjs`, and a few Vercel environment variables).
- Secured on the server: scrypt-hashed passphrase, optional email and TOTP two-factor, lockout after 5 failures, signed 8-hour tokens in an Authorization header, same-origin POST only, strict validation, full audit trail. The service-role key never reaches the browser.
- The app now obeys it: flags and prices, a dismissible announcement banner, a full-screen maintenance message, and an "update required" screen. If the config can't be reached the app uses its saved copy or built-in defaults.
- New public endpoints `GET /api/config` and `POST /api/feedback` (support messages are also kept for the inbox; Formspree still emails you).
- The dashboard is never cached by the service worker, is `noindex`, disallowed in robots.txt and served with a strict content-security policy.
# Changes in 0.16.0 — advanced themes have their own weather, all over the app

Each advanced theme now runs its own animation across every screen, by itself (no tapping needed), falling over the content without ever blocking taps. Tapping still adds a burst in the same style.
- **Fire:** drops of fire fall from the top with a glowing tail, and a few embers rise from the bottom. Tapping splashes fire drops and embers.
- **Water:** a light rain of thin streaks, some ending in a small splash ripple. Tapping makes a ripple and droplets.
- **Bubbles:** bubbles appear all over the screen, float a little and **pop** with a ring and a spray of specks, plus the odd bubble drifting up. Tapping pops a few bubbles.
- **Ice:** snow: ice crystals and soft flakes drift down with a gentle sway and spin. Tapping scatters flakes.
- Each theme has its own pace, the number of particles is capped (so it stays light on the phone), it pauses when the app is in the background, and it is off for people who prefer reduced motion (the colours remain).
# Changes in 0.15.0 — polish pass and the prediction engine (built, switched off)

## Polish (found with an automated design audit of 29 screens in light and dark, plus all four themes)
- **Contrast:** the bottom-nav labels, small accent links ("Full table", "Open in Maps", "Change avatar"), secondary buttons, the Premium step numbers, the coin "-10%" badge, the Profile login button and the "or" divider were all below readable contrast in Light and/or Dark; fixed. Theme fills were darkened so white text reads on Fire, Water and Bubbles, and Ice now uses dark text on its light-cyan buttons and the date selector.
- **Bottom bar** is more opaque, so page text no longer ghosts through it.
- **Tap targets:** sign-in links ("Forgot password?", Terms, Privacy) and the small #hashtag chips on news cards have bigger hit areas.
- **Tabs** in a scrolling tab row (match page) now scroll the chosen tab into view, so the active tab is never hidden off-screen.
- No horizontal overflow, missing icons, broken images or content hidden behind the bottom bar were found on any screen.

## Predictions: ready to switch on (not API-Football)
- API-Football's predictions are gone from the client and from the proxy allow-list, and its "Predictions" coverage chip is removed from league pages.
- New in-house model (`src/predictions/`): attack/defence strengths at home and away from the league table, expected goals, a Poisson scoreline grid, then win/draw/loss, over/under 2.5, both teams to score, likeliest score and a confidence level. Recent form nudges it by at most 8%. Costs no extra API requests beyond one cached standings call per competition.
- **Honest tracking:** each prediction is saved before kick-off (never after) and graded on the 90-minute result when the match ends; the VIP tab can show tracked winner / over-under accuracy and Brier score once matches have been graded.
- **Off by default.** The match page still says "Predictions are coming soon" and the VIP tab keeps its sample notice. To try it on one device open the app with `?flag=predictions:on` (or `:off`). To launch for everyone set `predictions: true` in `src/features.js`.
- When on: the match page Prediction tab shows a probability bar, likely score, expected goals, over 2.5, both-teams-score and plain-language reasons (before kick-off only); the VIP tab lists today's model picks (locked per match for non-Premium users, as before).
- `docs/PREDICTIONS.md` describes the method and the recommended next steps (server-side tracking table, calibration, better inputs).
# Changes in 0.14.0 — app-wide advanced themes, News tab with #tags, performance

## Advanced themes now restyle the whole app
- Fire, Water, Ice and Bubbles are no longer limited to the bottom bar. An active theme now brings: a themed gradient page with slowly drifting colour behind the content, glass cards, lists and headers (frosted, with soft borders), gradient buttons, tabs and headings, themed live indicators, **particles on every tap anywhere in the app**, and slow ambient particles across the screen (bubbles rising, embers drifting up, crystals falling, ripples). Light and Dark both look right.
- Theme colours take over while a theme is active; club colours pause and resume when you switch the theme off (Appearance says so). Reduced-motion users get the colours without the motion. It uses more battery than the standard look, and the Themes page says so.

## News is a bottom-nav tab
- Bottom navigation is now Games, VIP, Leagues, **News**, Profile (the News row moved out of Profile).
- **Filter by #hashtag**: #PremierLeague, #LaLiga, #SerieA, #Bundesliga, #Ligue1, #ChampionsLeague, #EuropaLeague, #WorldCup, #Transfers and 12 big clubs. If you chose a club's colours, that club appears first with a star. Each article also shows the hashtags it is about; tap one to filter. The filter is kept in the address (`/news?tag=laliga`) so it survives reloads and can be shared.
- Each hashtag is a fixed search on the server (`api/news.js` shares `src/newsTags.js`), so nothing free-form is ever sent to the news provider; every tag is cached per page for 15 minutes.

## Performance
- All startup modules are now preloaded in parallel (`<link rel="modulepreload">`, generated by `node scripts/build-shell.mjs`; run it after adding or renaming files under `src/`). On a throttled mobile profile with compression on, time to a running app fell about 15% (2.03 s to 1.72 s) with first paint unchanged.
- Service worker: code (JS/CSS) is served from cache instantly and refreshed in the background; page loads wait at most 2.5 s for the network before falling back to the saved shell, so a poor connection never stalls the app. Cache version bumped to clear old files.
- Images decode off the main thread; early connection to the image host.
- Fixed a layout bug where the fifth bottom tab wrapped to a second row (found while testing).
# Changes in 0.13.0 — club colours, substitution popup, working search, API savings, Formspree support

## Club colours (Appearance)
- Appearance now has **Club colours**: pick Barcelona, Chelsea, Arsenal, Real Madrid and about 35 other clubs, or any colour of your own. The whole app follows it: buttons, active tab, links, live scores and badges, and a faint tint on the backgrounds. Colours are re-derived for Light and Dark so text always stays readable (every club in the list was checked for contrast in both modes, e.g. yellow Dortmund gets dark button text). Light/Dark/System still work on top. Applied before first paint, so no flash.

## Lineups
- Tap the red substitution arrow on a player to see a tiny popup: minute and **who replaced him** (tap the name to open that player). Tap the arrow again, the pitch or wait to close it. It stays inside the pitch edges.

## Search
- Tabs: **All, Matches, Clubs, Leagues, Venues, Players**. All now includes players too.
- **Player search fixed.** It used the stats endpoint, which only works with a league chosen first. It now uses API-Football's player profile search (name only, no league step). Type 3+ letters.
- **Failures are visible.** Any section that fails shows a clear message with a Try again button (also if something throws unexpectedly), and no matches shows "No results".
- `api/football.js` allow-list gained `players/profiles`. **Redeploy it.**

## API usage and caching
- Three cache layers: memory, per-tab session storage, and a long-lived tier in the browser (localStorage, capped at about 2 MB).
- **Venues cached for one year, players for one day** (player profiles, squads, seasons, trophies, transfers), in the long-lived tier so they survive closing the app. Clubs, leagues and coaches are cached for a day; league leaders for an hour; head to head and rounds for six hours.
- Finished matches are never re-fetched: a finished fixture is cached for a day, and its events, lineups, stats and ratings are read from the single match response instead of 3 to 4 extra calls. Past days, days with nothing live (2 minutes) and days where nothing has started (10 minutes) are cached longer than live scores (30 seconds).
- The server (`api/football.js`) mirrors this for the shared edge cache (venues one year, players one day, finished matches one hour).
- Slow data may be shown up to 6 hours stale while it refreshes quietly. Live data is never shown stale. Pull-to-refresh clears everything except venues.
- Quota and blocked storage are handled without errors.

## Support and feedback (Formspree)
- **Send feedback** (new, Profile -> Support): star rating, topic, message, optional email.
- **Report an issue** and a new **Contact us** message form now post to your Formspree form (`xwlpozrq`) instead of opening the mail app. Each submission includes the message, topic, email, app version, page, language, browser and screen size.
- Friendly validation, a spam trap, a 20-second gap between messages, clear errors that keep what you typed, and a thank-you screen on success. Email is prefilled for signed-in users. Direct email/social links remain below the Contact form.
# Changes in 0.12.0 — rounds, reliable pull-to-refresh, richer match page, session cache, SEO

## Leagues with rounds
- League -> Matches now has a **Rounds** view (shown whenever the competition has rounds): step through them with the arrows or pick from a list, starting on the current round. Upcoming and Results stay as flat lists. Cups and group/league-stage competitions work the same way.
- Round names read naturally everywhere ("Regular Season - 12" -> "Matchday 12", "Group Stage - 3" -> "Group Stage · Matchday 3"; knockout names unchanged).
- `api/football.js` allow-list gained `fixtures/rounds`. **Redeploy it.**

## Pull to refresh
- Works in a normal browser tab as well as the installed app, and on every screen. Forms get a "soft" refresh that clears cached data without wiping what you typed.
- The browser's own pull-to-refresh / rubber-band is now cancelled for any downward drag that starts at the top of the page (before, it leaked through on screens that opted out, during a refresh, and after a small finger wobble). `overscroll-behavior-y:none` now also sits on `<html>`.
- A slight upward wobble no longer ends the pull; scrolling lists and open sheets keep their own scroll; refresh also clears the news cache and the session cache.

## Match page
- **Last 5 form** under each team's name (oldest to newest, latest ringed): green W, grey D, red L. It counts finished matches before this one.
- **Goal scorers** under the score (own goals and penalties marked; own goals are credited to the right team by checking against the final score).
- **Events bug fixed:** a missed penalty is sent by the provider as a "Goal"; it now shows as "Missed" and never counts as a goal (also excluded from scorers).
- **Live countdown** to kick-off instead of dashes (days/hours/minutes, then hh:mm:ss ticking each second); matches refresh themselves from five minutes before kick-off.
- **Red cards** show as a red card badge on the team's logo (with a count for two or more).
- **Predictions** tab is now empty ("Predictions are coming soon") and no longer calls the predictions API.

## Session caching
- API responses are mirrored into sessionStorage, so a reload or returning to a page within the same tab session paints instantly. Slow-changing data (leagues, teams, squads, leaders, etc.) may be shown stale for up to 6 hours while it quietly refreshes; live data (fixtures, events, lineups, stats, odds, standings) is never served stale. News is cached the same way. Pull-to-refresh clears it. Storage errors/quota are tolerated.

## SEO (livescore, predictions, football data)
- New title, description, keywords, Open Graph/Twitter tags, canonical URL and robots tags; per-page titles for matches ("Arsenal 2-1 Chelsea Live Score"), leagues, clubs, players and venues; account/settings pages are `noindex`.
- JSON-LD: WebSite with a search action, Organization, WebApplication, and **SportsEvent** for every match; breadcrumbs on prerendered pages.
- **Crawler prerender** (`api/seo.js`): search and social bots get a fully rendered HTML page per URL (real title, meta, content and links, including today's matches on the home page, league tables, match details and goals). People still get the app. Wired in `vercel.json` by user agent.
- `/sitemap.xml` (static pages, major competitions, today's matches; cached 1 hour) and `/robots.txt` are generated by `api/sitemap.js` and `api/robots.js`.
- Optional env var `SITE_URL` (e.g. `https://yourdomain.com`) fixes the domain used in canonicals and the sitemap; without it the request host is used.
- Crawlable intro text and links now live in the page before the app boots.
# Changes in 0.11.0 — live news, advanced themes, live-match alerts, dark toasts

## Dark mode
- Toast banners ("Not enough coins", "Theme applied", goal alerts...) had a hard-coded white background, so their white dark-mode text was unreadable. They now use theme tokens (`--toast-bg`, `--toast-edge`). The Notifications screen itself was checked in dark mode and uses theme tokens throughout.

## News (TheNewsAPI)
- New `api/news.js` proxy reads the token from the **`NEWS_ACCESS`** Vercel environment variable (also added to `.env.example`). It asks for English sports articles about football, newest first, and falls back to a broader query if the first returns nothing. Responses are edge-cached for 15 minutes to protect the plan's request quota.
- The News page shows a featured story plus a list: headline, summary, source and "x ago", and a **Read full story** link that opens the original article in a new tab. "Load more" fetches the next page (the free plan returns only a few articles per request). Loading, error and empty states included. The sample-headlines notice is gone.
- **Redeploy needed** and set `NEWS_ACCESS` for Production (and Preview if you use it).

## Advanced themes
- Profile -> Preferences -> **Advanced themes** (under Appearance): Fire, Water, Ice and Bubbles.
- Fire (50), Ice (40) and Bubbles (30) are bought once with coins. **Water is part of Premium** and can't be bought with coins. Premium also adds a **verified badge** next to your name on Profile; both perks are listed on the Premium screens.
- An active theme turns the bottom bar into floating liquid glass with a lens that slides under the active tab, an ambient glow, and themed particles you trigger by pressing or gliding across it (bubbles, embers, falling crystals, ripples and droplets). Each theme card has a live, playable preview, even while locked. Respects reduced-motion.
- Saved state: `unlockedThemes` and `fxTheme` (water stops applying if Premium lapses, without losing the choice).

## Live matches
- **Goal vibration** and **half-time / full-time whistles** (synthesised in the browser, no audio files), plus an in-app banner for each. Both can be switched off under Notifications -> Live matches (existing users get them on by default).
- Alerts work while the app is open: on the match page you are watching and on starred matches in today's Games list. Live match pages and today's list now refresh themselves every 60 seconds while a match is in play (one request per refresh), and the score pops when a goal goes in.
- Vibration is not supported on iPhone browsers; whistles need one tap on the app first (browser autoplay rule).
- Not included: alerts while the app is closed (needs push notifications).

# Changes in 0.10.0 — match ratings, full search tabs, no page slide, new Games icon

## Match page
- The Scoutwave logo in the Match header is gone; the header reads "Match" again.
- **Player ratings.** Lineups now show each player's rating as a coloured pill on the pitch and on the substitutes list, and a new **Ratings** tab lists every rated player of both teams, best first, with a "Top rated" tag. Colours: 8+ blue, 7+ green, 6+ amber, below 6 red. Ratings come from API-Football's per-fixture player stats; before kick-off (or if the provider has none) the pills simply don't appear and the Ratings tab says so. A failed ratings request never breaks the Lineups tab.
- `api/football.js` allow-list gained `fixtures/players`. **This file must be redeployed** or the ratings request is rejected as an unsupported endpoint.

## Search
- Tabs are now **All, Matches, Teams, Leagues, Venues, Players**, as a scrollable pill row.
- One search field is shared by every tab except Players, so switching tabs re-runs your query instead of making you retype it. A tab only fetches when it is visible, and revisiting it with the same query does not refetch.
- **Matches** shows today's games for the typed team, plus Upcoming and Recent results for the two best-matching teams (API-Football has no free-text match search, so this is built from team fixtures; it costs up to 5 requests per query, all cached).
- Dedicated tabs show up to 15 rows per kind (the All tab keeps 5). "Clubs" is labelled "Teams" here.

## Navigation
- Removed the slide/fade-in animation when navigating between pages (including the sign-in screen's rise-in). Screens now appear instantly. Pull-to-refresh, toasts and sheets are unchanged.

## Bottom navigation
- The Games tab uses the new scoreboard-style filled icon (`games` in `utils/icons.js`).
# Changes in 0.9.0 — branded social share images

## Share images: match, player, club, venue, league
- A share button in every one of those five pages' headers generates a branded, portrait (1080×1920) image — final score and crests for a match, photo and season stats for a player, crest and home ground for a club, and so on — with the Scoutwave mark and a Premier-League-red gradient background.
- Uses the device's native share sheet when available (so it goes straight to Instagram/WhatsApp/etc. as a real image, not a link), with Download as the fallback everywhere else.
- A new piece of infrastructure makes this possible safely: `api/image-proxy.js`, an allow-listed, same-origin proxy for crests and photos. Drawing a remote image onto a `<canvas>` and then exporting it only works if that image was served with the right cross-origin permissions — which api-sports.io's image host doesn't document, and I wasn't willing to gamble a whole feature on. Routing every image through this app's own origin first sidesteps the question entirely: canvas never taints on a same-origin image, regardless of what the upstream host does or doesn't send.
- Every failure path shows a real message with a retry, matching the rest of the app: a network error, a missing image, an oversized response. A missing crest or photo degrades to a plain placeholder rather than failing the whole card.

## A mid-session environment reset, and how it was handled
Partway through building this feature, the development sandbox reset and the in-progress working copy was lost. The last *delivered* zip (0.8.0, already in your hands) was unaffected — this only cost rebuilding time, not shipped work. Recovery: restored the app from that last verified zip, rebuilt the test harness, then re-applied the share-image feature from the same code already written earlier in the session. Worth flagging on its own merits: while re-verifying after the rebuild, a real bug turned up in the share sheet's close button (a flag was being cleared before the event that was supposed to check it, so the ✕ button silently failed to close the sheet) — caught by the same before/after testing discipline used throughout, fixed, and confirmed stable over several clean runs before packaging.

## Test suite
- New: `image-proxy.test.mjs` (10 checks on the proxy's allow-list, error handling, and caching headers) and a rebuilt `e2e.mjs` covering the share feature specifically (all five card types generate correct 1080×1920 output; the sheet is dismissible by its Close button, a backdrop tap, and the device back button; a slow/failed image degrades gracefully; downloading saves a real file) alongside regression coverage for everything from the previous two phases (favourites, search, dark theme, PWA mode, pull-to-refresh).
# Changes in 0.8.0 — PWA behavior + a real, custom pull-to-refresh

## PWA/standalone mode restrictions
- Text selection, the long-press callout menu, and pinch/double-tap zoom are now disabled — but **only** when installed as a PWA (standalone mode). A regular browser tab is untouched, since all three are genuinely useful there (copying text, zooming in on fine print, "Open in new tab" on a link).
- Detected via `display-mode: standalone` (plus the older iOS `navigator.standalone`), applied through a `data-pwa` attribute so it's pure CSS wherever possible. Form fields (email, password, search, the report-issue textarea) stay selectable in both modes — the restriction is about the app's own chrome, not what you've typed.

## Custom pull-to-refresh
- Built from scratch on real touch events (the browser's native pull-to-refresh was already disabled). Pulling down at the top of any screen slides the content itself down — like iOS — with a small dial riding in the gap above it: an arrow that rotates open as you pull, flips to "ready," then spins while refreshing.
- A genuine refresh, not just a spinner: it clears the app's API cache and re-fetches, so you actually get fresh data, not a redraw of what was already on screen.
- Only active where a refresh is safe. Screens with a form the user might be mid-typing into (sign in, edit profile, change password, report an issue) opt out entirely — the gesture doesn't just skip the refresh there, it does nothing at all, so there's no risk of ever wiping what someone typed.
- Respects reduced-motion (skips the spring-back animation, keeps the mechanism).

## Test suite
- 64 end-to-end checks (up from 58): 2 for PWA-mode restrictions, 4 for pull-to-refresh — including synthetic touch gestures for a full pull-and-release, a too-short pull that springs back without refreshing, scrolling down (which must leave the gesture untouched), and confirming it's fully inert on a form screen with unsaved text.
- All suites run clean three-plus times in a row before packaging, including after two rounds of self-review that caught real, worthwhile bugs before they shipped: the dial and content weren't visually connected on the first pass (dial floated over the content instead of opening a gap above it, per the design brief); a completed animation was permanently pinning the screen's transform, which would have fought the very next pull.
# Changes in 0.7.0 — search: matches, fixed player search, real error feedback

## Search
- Added a "Today's matches" section to the All tab — searching a club now also surfaces its match today, if it has one (API-Football has no free-text match search, so this covers today only, labelled honestly).
- **Fixed player search**: it was always requesting the league's current-season stats, which often has no indexed data yet early in a season. It now retries the previous season automatically, the same fallback already used elsewhere in the app.
- Added a "Popular leagues" quick-pick to the Players tab, shown before typing anything, so starting a player search no longer requires first typing and searching a league name blind.
- **Every failure now shows a message.** A failed section (rate limit, network error) shows the real error instead of silently disappearing. Searching for something that matches nothing, anywhere, now shows "No results for '...'" instead of leaving a blank area — both were confirmed bugs matching exactly what was reported.
- The Players tab's "Popular leagues" no longer loads eagerly the moment Search opens — it now only fetches once the user actually taps the Players tab, saving 6 API calls on every visit to Search that never uses it.

## Test suite hardening
- While building this, found and fixed a real, latent race in the shared test helper used by nearly every test: it considered a lazy-loaded screen "ready" the moment its loading skeleton appeared, not the real content — occasionally letting a test proceed and interact with a screen a beat before it had actually finished loading. Fixed at the root (skeleton is now explicitly excluded), rather than papering over the occasional symptom.
- Fixed two similar synchronization races in newer tests (favourites, club season picker) that assumed one section finishing meant every section had, which doesn't hold when different favourite types or stats take genuinely different amounts of time to load.
- Fixed a mock-server-state cleanup hazard: three tests that temporarily forced an error/empty condition reset it *after* their assertions, so a failing assertion would skip the reset and silently corrupt every later test in the run. Now wrapped in try/finally so the reset always happens.
- 58 end-to-end checks (up from 54), run clean four times in a row, plus the full unit and robustness suites.
# Changes in 0.6.0 — logo header, dark-mode contrast fixes, favourites for everything

## Home header
- Replaced the "Games" text title with the Scoutwave logo (theme-aware, swaps with the app's dark palette).
- Along the way, found and fixed the *same* logo swap missing its dark-mode CSS rule on the Match page header — added there too, since it's the same asset pair.

## Dark mode contrast
- The brand red used for small running text (nav "Back", tab bar labels, kickers, links, live badges, season pickers) measured 3.83:1 against pure black — under the 4.5:1 accessibility minimum. Introduced `--accent-text`, a WCAG-checked brighter red for dark mode (6.16:1), applied only to real text. Button/icon backgrounds are untouched. Light mode is byte-for-byte unchanged (verified).

## Favourites: matches, clubs, players, venues and leagues
- Every entity page (club, player, venue, league) now has a favourite star in its header, matching the one matches already had.
- The Favourites page lists all five kinds in their own sections — each fetches and fails independently, so one slow or broken favourite never blocks the rest. Un-starring removes a row live and collapses its section when empty; the page falls back to one empty state once everything is gone.
- Existing favourited matches are migrated automatically from the old storage shape — nobody's favourites are lost by this update.

## Investigated, fixing next
- **Player search**: confirmed it's likely returning empty for many players because it always requests the *current* year's stats, which often has no data yet. The rest of the app already falls back to the previous season in this situation (`getPlayerProfile`); player search needs the same fix, plus a friendlier league-picker (a "Popular leagues" quick-pick instead of requiring a typed search first) and a pass to add match search and confirm every failure path shows a message instead of going blank.

## Verification
- 54 end-to-end checks (up from 52), plus the full unit and robustness suites, all run clean three times in a row before packaging.
# Changes in 0.5.0 — dark theme + club season selection

## Dark theme
- A full dark palette (Apple's grouped-table values: black canvas, #1c1c1e elevated cards, translucent separators) layered on top of the existing design tokens. Every light-mode color is unchanged — verified with a regression test that checks exact computed colors.
- New **Appearance** setting (System / Light / Dark) in Profile → Preferences, matching the existing Language picker's design.
- No flash on load: an inline script in `index.html` reads the saved choice and sets the theme before the page paints. `src/theme.js` then keeps it in sync at runtime and reacts live if the device's system theme changes while "System" is selected.
- The status bar color (`<meta name="theme-color">`) switches with the theme.

## Club page: season selection
- Added the season picker the league and player pages already had. Switching seasons on the Club page swaps Overview to season-based form + league position, filters Matches by competition, and reloads Stats for the chosen competition and season. Squad stays current-only with an explicit note, since historical squads aren't available from the provider.

## Verification
- 52 end-to-end checks (up from 46), including 6 new tests specifically for the dark theme: follows the OS setting on first load, explicit choice overrides it, choice persists across reload, live-reacts to an OS theme change, actually repaints (not just an attribute), and a byte-for-byte regression guard that the light theme's computed colors didn't move.
- All suites (unit, e2e, robustness) pass cleanly, run twice in a row to rule out flakiness.

# Changes in 0.4.0 — real pitch lineups + richer league / club / player / venue pages

## Match lineups: an actual pitch
- Both teams on one vertical pitch (home top, away bottom), players placed by the provider's formation grid, so a 4-2-3-1 really looks like a 4-2-3-1. Each team's formation and coach are shown.
- Falls back gracefully when the grid is missing: builds rows from the formation string, then from player positions. Malformed data never drops a player or crashes.
- Kit colours from the provider when readable (numbers auto-contrast, the two teams are always distinguishable).
- Live match events overlaid on the players: goals, cards, and substituted-off markers; substitutes list shows who came on and when.
- Verified at 390 px and 320 px wide.

## League page
- Season picker (reloads every tab; also a way to reach a season your plan allows).
- Overview: season facts and status, top of the table, next matches, top scorers, clubs, and which data the provider covers.
- Table: P/W/D/L/GD/Pts, last-5 form dots, promotion / relegation / European zones with a legend, every group for cup formats.
- Matches: Upcoming / Results. Players: Goals, Assists, Yellow, Red.

## Club page
- Overview: league position, manager, next match, recent form (W/D/L), season snapshot. Matches: upcoming and results with W/D/L. Squad by position. Stats from the provider's full team statistics.

## Player page
- Season picker (seasons the provider has for that player), Overview (current club, season summary, profile), detailed Stats per competition, Career and Trophies tabs.

## Venue page
- Photo, capacity and surface, address, home clubs, upcoming and recent matches, and an Open in Maps link.

## Under the hood
- New allow-listed proxy endpoints and parameters (coachs, trophies, transfers, players/seasons, player, coach, from, to, round, status), with edge caching.
- Async pages are now `<main>` landmarks like the rest of the app.
- New automated checks: lineup layout unit tests, and a robustness run that opens every page and tab with normal data, empty data and provider errors and asserts no crash screen, blank panel, stuck loader or console error.

# Changes in 0.3.0 — iOS design system + authentication polish

## Design system (src/styles/theme.css rewritten, ~55 KB, was 67 KB of layered overrides)
- iOS "grouped" hierarchy: #f2f2f7 canvas, white inset cards, hairline separators, 14 px radii, tabular numerals for scores.
- SF-style type stack (system font on Apple devices, DM Sans elsewhere), 34 px large titles, 17 px body, no text under 11 px.
- Translucent blurred navigation bar (chevron + "Back", centred title, sticky) and tab bar, safe-area aware.
- Settings-style lists with coloured icon tiles, iOS toggle switches, checkmark selection lists.
- Segmented control for tab sets of 2-4; scrolling pills for the 6-tab match screen.
- Date strip in the iOS Calendar style; Home matches as inset league cards with hairline rows.
- Search screen rebuilt: iOS search field, segmented All/Players, grouped results.
- Toasts are blurred capsules with status icons; press states, screen-enter motion (reduced-motion respected).
- Sticky headers now actually stick (the old `overflow:auto` on screens disabled them).
- App icons are now a brand-red tile with the white mark; new `scoutwave-mark*.png` / `scoutwave-wordmark.png` assets.

## Authentication
- Sign in / Create account / Reset password / New password rebuilt: brand-mark tile, large title, Google button with the official multicolour mark, or-divider, filled rounded fields with leading icons.
- Show/hide password, live validation (submit enables only when valid), inline email hint, Enter to submit, correct autocomplete / inputmode / enterkeyhint for password managers.
- Password strength meter (sign up + reset) and live "passwords match" hint.
- Loading spinner in the button, shake on error, alert below the fields (no layout jump).
- "Check your email" state for sign-up and reset with a 30 s resend cooldown (new `supabase.auth.resend`).
- Skip (guest), Back, and Terms / Privacy links.

## Other
- Bottom tab highlights Games for matches and Leagues for league / club / player pages.
- Profile: Settings-style groups, sign-in / sign-out row.
- Kick-off times shown as 6:14 PM (no leading zero).

# Changes in 0.2.0

## Broken, now fixed
- **Match screen never loaded**: `MatchScreen` imported four API functions that did not exist. Added them; rebuilt the screen (scoreboard, summary + head-to-head, events, lineups, stats, odds, prediction) with the CSS it was missing.
- **Blank page on any deep link / refresh** of a nested URL (`/match/…`, `/league/…`, `/auth/update`): `index.html` used relative `./src/…` paths. Now absolute.
- **First paint** guarded: store no longer re-renders when nothing changed, so the app renders explicitly on boot.
- **API key exposure**: removed the key from `src/api/config.js` (publicly served) and `api/football.js`. Proxy reads `SCOUTWAVE_FOOTBALL_API_KEY`. Added `.gitignore`. **Rotate the old key.**
- **Leagues tab opened the wrong league** (name slug). Now `/league/<id>-<slug>`; legacy slug links resolve (hyphens → spaces) and redirect.
- **Team squad crashed** (wrong response shape) and **team stats were always empty** (proxy flattened the object response to `[]`).
- **Club fixtures** combined `last`+`next` in one request; now two requests, merged. Team stats use the domestic league, not a cup.
- **Blank icons**: added `circle-user-round`, `pencil`, `chevron-down`, `arrow-right`, `arrow-up-right`; unknown icons now warn in the console.
- **Favourites**: star restored on Home rows; Favourites screen loads real fixtures (`ids=` batches of 20); legacy mock ids dropped.
- **Auth**: signed-in users leave `/auth`; password-recovery link opens a real "set new password" screen; expired links show a message; `redirect_to` is sent correctly for sign-up and reset; a network blip no longer signs you out.
- **Profile**: real display name (saved to Supabase user metadata), working Change password (re-verifies current password), Report issue opens a pre-filled email; fake phone number and `#` links removed.
- **Global error handlers** no longer replace the whole UI after startup.
- `aria-*` booleans now render `"true"/"false"`; `text()` no longer prints "undefined".

## Quota / performance
- TTL cache + in-flight de-duplication in the API client (30 s live data, 5 min standings, 10 min static). Cold load = 1 fixtures request.
- Star toggles no longer re-render the app (no refetch, no scroll jump); scroll position kept on same-screen re-renders.
- Proxy: endpoint + parameter allow-lists, per-endpoint edge caching.

## Correctness
- Home uses the local calendar day (was UTC) and sends the browser timezone; shows kickoff time / live minute instead of `NS`.
- Leagues grouped by league id (two "Premier League"s stay separate), popular leagues first.
- Search: 3-character minimum (API rule), punctuation stripped, stale responses ignored; player search uses the league's own season; player pages fall back one season.
- Multi-group standings (e.g. Champions League) show every group.

## Honesty / design rules
- Removed the fabricated VIP hit-rate stats and news item; VIP feed, News, Language and Notifications now say what is sample/not live.
- Removed the non-functional dark-theme toggle. ALL-CAPS mono eyebrows and middle-dot meta text removed everywhere.

## Added
- Odds tab on the match screen (existing `OddsTable`, real bookmaker data).
- PWA: manifest, icons (from the logo mark), service worker (network-first code, offline shell), theme-color, viewport-fit.
- Fonts via `<link>` + preconnect instead of a render-blocking `@import`.

## Left for you to decide
- Predictions and odds are **not gated** by VIP/coins on real matches (the gating only existed for mock data).
- Coins/VIP/favourites live in localStorage, not in your Supabase account.
- Avatars use real footballers' likenesses; confirm you have the rights.
- Confirm `SUPPORT_EMAIL` in `src/config.js`, and add social URLs.
- Server-side proxy is kept (keeps the key private); say so if you want it removed.
- Confirm your API-Football plan covers the current season and your daily quota.
