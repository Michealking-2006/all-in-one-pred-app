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

- **Less to load at startup (0.27.2).** Touch gestures (pull to refresh), push settings, usage reporting, the prediction tracker and model, and the server-only SEO code no longer load before the first screen: the startup code went from 220 KB (41 files) to 185 KB (37 files). Gestures and reporting start when the browser is idle.

## Not done, and why
- **No bundler or minifier.** The app serves its modules as written (about 205 KB for startup, which is roughly 50 KB compressed in transit) and 130 KB of CSS. A bundler would cut requests and a little size, but needs a build step and tooling this project doesn't have; the batching, drawing in pieces and image changes above matter more for memory.
- **No real-device measurements.** Everything above comes from reading the code and sizing the assets, not from profiling a 1 GB phone. After deploying, open the app on one (Chrome > chrome://inspect, or Android's Developer options "Running services") and compare memory on Home and a club page.
