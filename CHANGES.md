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
