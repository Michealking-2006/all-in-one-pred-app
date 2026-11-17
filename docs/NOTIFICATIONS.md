# Push notifications and usage charts

## Lineup alerts (about an hour before kick-off)
A push "Lineups are in" (with both formations and the minutes to kick-off) the moment both team sheets are published, for **starred matches and clubs**, to devices with the *Lineup alerts* switch on. Same job as the other alerts (`/api/cron?task=push`), nothing else to schedule.
- **Run `supabase/migrations/011_lineup_alerts.sql` once.** It adds the column that remembers a match has had its alert, so it is sent once. Until it is run, lineup alerts stay off and the job's summary says so; every other alert works as before.
- Cost: one request for the day's match list (remembered 30 minutes), then one lineup lookup per watched match that starts within `PUSH_LINEUP_MINUTES` (default 75), remembered 4 minutes whether or not the sheets are out; at most `PUSH_LINEUP_MAX_CHECKS` (default 8) lookups per run. Nothing is requested when nobody has the switch on and a watched match coming up. `api_cache` (migration 009) makes the remembering shared between runs; without it each run may repeat a lookup.
- Devices signed up before this update send the new switch to the server once, the next time the app is opened.

## Followed players (goals, assists, cards)
Starring a player (the star on their page) follows them. The app remembers their club (updated whenever you visit their page, so a transfer is picked up) and sends `{ playerId: clubId }` to the push service with the *Followed players* switch. While one of those clubs is playing, the push job reads the match's events (`fixtures/events`) and sends one alert per goal ("Palmer scored", "set up a goal", "scored a penalty", "scored an own goal"), yellow card ("was booked") or red/second yellow ("was sent off").
- **Run `supabase/migrations/012_follow_players.sql` once.** Until then signups still work (the players are simply not stored) and the job skips player alerts and says so in its summary; every other alert is unaffected.
- Nothing old is announced: the first time a match is looked at it only records what has already happened, and the events of *every* player are recorded, so someone who starts following a player mid-match never gets earlier events.
- Cost: only matches where a club has a follower are looked at, at most `PUSH_PLAYER_MAX_CHECKS` (default 6) per run, each remembered for a minute. Goals therefore reach the phone within about a minute or two.
- With the app open, the same events show as banners (the push service stays silent while the app is on screen). Missed penalties and substitutions are never alerts.

## In the app (no push needed)
- **Goal celebration**: when the club a person supports (Appearance) scores in a match the app can see (an open match page, a starred match, or their club's match while the app is open), the crest pops with the score and confetti in the club's colours, plus a longer buzz. Other goals keep the usual banner. Switch: Notifications > Goal celebration. Reduced-motion and low-end phones get the crest only, without confetti.
- **Live match card**: starred matches that are in play are pinned above the tab bar on every screen (crests, score, minute, tap to open, cross to hide until the next goal). It asks the football service only when a match is live or about to start (or every 5 minutes), sharing the app's cache. Switch: Notifications > Live match card.

## What people get
Goals, kick-offs, half-time and full-time for the **matches and clubs they have starred**, delivered even when Scoutwave is closed. They turn it on under Profile > Notifications > "Alerts on this device". It follows the existing switches: *Match kickoff*, *Goal alerts* and *Half-time and full-time whistle*. VIP tips, favourite-team news and odds alerts are not sent yet. While the app is open and in view it shows its own banner, so no second alert appears.

On **iPhone and iPad** web push only works after the person adds Scoutwave to the Home Screen (iOS 16.4 or later); the screen says so. Goal alerts say which side scored and the minute, not the scorer: the live feed doesn't include names without an extra API call per goal.

## Set up
1. Run `supabase/migrations/005_usage_and_push.sql` in the Supabase SQL editor (also creates the usage tables).
2. `node scripts/generate-vapid.mjs` prints the three values. Add them in Vercel as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (use a real `mailto:` address) and redeploy. **Never change the keys later**: every signed-up device would stop receiving alerts.
3. `CRON_SECRET` must already be set (the prediction jobs use it too).
4. **Schedule the alert job every minute.** This is the one part that depends on your hosting plan:
   - **Vercel Pro:** add `{ "path": "/api/cron?task=push", "schedule": "* * * * *" }` to `crons` in `vercel.json`. It is not included by default because Vercel's Hobby plan rejects the whole deployment if a cron runs more than once a day.
   - **Any plan, free:** use an outside scheduler such as cron-job.org to request `https://app.myscoutwave.com/api/cron?task=push` every minute with the header `Authorization: Bearer <your CRON_SECRET>`.
   Alerts arrive within about a minute of the event.
5. Admin > Overview shows a "Push notifications" check; admin > Usage shows alerts sent per day.

## What it costs (football API requests)
One request per run (`fixtures?live=all`) plus one more when a watched match has just ended (final score). The job does nothing, and spends nothing, when nobody is watching a match. It also stops whenever less than 25% of today's quota is left (`PUSH_KEEP_FREE_SHARE`), so alerts can never starve the app. Every-minute polling is up to 1,440 requests a day: that fits the larger football API plans only; on a small plan (for example 100 a day) the guard will stop it almost at once and alerts will not work. Check your plan in admin > Usage.

## How it stays correct
- Only **changes** produce alerts: each watched match's last state is saved, and the first time a match is seen it is recorded without alerting, so signing up mid-match never replays old goals.
- State is saved *before* sending: a crash can miss an alert but never sends one twice.
- Devices whose push service says they are gone (404/410) are removed; ones that keep failing are removed after 8 failures.
- The server only sends to the real browser push services (Google, Mozilla, Microsoft, Apple); an arbitrary address is rejected when signing up.

## Usage charts (admin > Usage)
Last 14 days: football API requests per day split into the app, the prediction jobs and push alerts; the busiest endpoints; today's quota; and two cache hit rates.
- *On the device*: the share of the app's lookups answered from memory or the copy saved on the phone. The apps report totals only (no user or match data) every few minutes.
- *Shared edge cache (estimate)*: of the lookups that had to ask the server, how many were answered by the shared cache rather than the football provider. It is an estimate because only apps that reported are counted.
Provider requests are counted when a request actually reaches the provider, so a healthy cache shows up as a low number, not a gap.
