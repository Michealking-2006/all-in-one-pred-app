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
