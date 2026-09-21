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
