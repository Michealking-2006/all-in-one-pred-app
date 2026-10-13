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
