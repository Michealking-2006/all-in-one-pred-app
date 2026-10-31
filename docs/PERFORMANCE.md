# Performance and low-memory phones

## Two lighter modes (automatic, and switchable in Appearance)
| Tier | Phones | What changes |
|---|---|---|
| 1 "lighter" | about 2 GB, data saver on, very slow connection, weak Android phones | No blur or animated theme weather, smaller caches (80 responses in memory), slower background refresh (1.5x), long lists drawn as you scroll |
| 2 "lightest" | **1 GB or less** | Everything in tier 1, plus: no animations or transitions at all, much smaller caches (40 responses in memory, nothing over 90 KB kept, 300 KB on disk), no decorative photos (news pictures, stadium images, ad images; crests and player faces stay), share pictures drawn at half size (about 2 MB of memory instead of 8), background refresh at half speed |

Detection is in `src/perf.js` (and `src/boot/theme-init.js`, which runs before first paint). It uses the browser's reported memory, which Chrome rounds to 0.25, 0.5, 1, 2, 4 or 8 GB; Safari and Firefox don't report it, so those get tier 1 only through the core-count and connection checks. Appearance > Lighter mode **On** forces at least tier 1 (and tier 2 on a 1 GB phone); **Off** disables both.

## What was changed for everyone
- **One screen rebuild per tap.** Several state changes in the same moment (set tab, set day, show a toast) used to rebuild the whole page once each; they are now batched into one.
- **Long lists are drawn in pieces.** The match list on a busy day (60+ competitions, 500+ matches) paints the first sections straight away; the rest follow when the browser is idle, or, on lighter phones, only as you scroll near them (`src/utils/chunked.js`).
- **`content-visibility`** on match rows, news rows and competition sections lets the browser skip layout and painting for anything far off screen.
- **Images.** The two unused 1500x500 logos were deleted. The wordmarks (1348 px wide, shown 20-28 px high) are now 560 px, and the five avatar pictures are 192 px WebP: assets went from 523 KB to 91 KB, and the memory each decoded image takes dropped by about the same factor (the wordmark from 1.1 MB to 0.2 MB).
- **Backgrounds do less.** Live-score refresh already paused when the tab was hidden; it now also stretches by tier.
- Football data is fetched from the API once and cached in three layers (memory, tab, device); past seasons' tables are kept for a week.

- **Less to load at startup (0.27.2).** Touch gestures (pull to refresh), push settings, usage reporting, the prediction tracker and model, and the server-only SEO code no longer load before the first screen: the startup code went from 220 KB (41 files) to 175 KB (37 files) once the theme animation is also deferred. Gestures and reporting start when the browser is idle.

- **Icons are parsed once (0.28.0).** Each icon's markup is turned into elements once and copied afterwards; a busy match day draws 500+ star icons and used to parse the same text 500+ times.
- **Fonts no longer block the first paint.** The DM Sans stylesheet was a render-blocking request to another site; it now loads after the page has finished loading, is skipped on 1 GB phones and with data saver (they use the system font), and the unused Space Mono request is gone. The font stack was already system-first (iPhones and Macs never used DM Sans), so on those devices nothing changes visually; on Android and Windows text may appear in the system font for a moment, then switch.
- **Animated themes load on demand.** The theme list and unlock rules stay at startup (about 4 KB); the 9 KB of animation code downloads only for someone who has switched a theme on.
- **Cache lifetimes.** Vercel serves every file with "check again on every load", which cost one round trip per file (about 40) on every launch. App code is now reused for 5 minutes (and refreshed in the background for a day), images and icons for a week. Pages, the service worker, the API and the admin stay fresh. A new release can therefore take up to about 5 minutes longer to reach someone who already has the app open.
- **A budget test** (`tests/startup.test.mjs`) fails if startup code grows past 180 KB or 40 files, or if one of the deferred modules is imported at startup again.

## Large traffic (0.38.0)
The football data quota is the wall, not the servers. What keeps it flat as visitors grow:
- Every football request is the same URL for everyone, so the shared edge cache answers all of them. Time zones used to split this: the list of a day's matches (the most polled request) was cached once per time zone. It now asks for UTC days and the app keeps the matches on the user's local day, so one cached answer serves the world. A visitor in most time zones loads two lists instead of one; the second is almost always already cached.
- If a cached answer expires while many people are asking, each server instance asks the provider once and shares the answer.
- Background traffic to our own API is lighter: cache counters go out every 15 minutes (and at most every 2 when the app is hidden) instead of every 5; the account check runs every 10 minutes.
- Watch Admin > Usage after a busy match day: provider requests per day should stay close to the number of distinct matches, leagues and days people looked at, not to the number of visitors.

## Not done, and why
- **No bundler or minifier.** The app serves its modules as written (about 205 KB for startup, which is roughly 50 KB compressed in transit) and 130 KB of CSS. A bundler would cut requests and a little size, but needs a build step and tooling this project doesn't have; the batching, drawing in pieces and image changes above matter more for memory.
- **No real-device measurements.** Everything above comes from reading the code and sizing the assets, not from profiling a 1 GB phone. After deploying, open the app on one (Chrome > chrome://inspect, or Android's Developer options "Running services") and compare memory on Home and a club page.
