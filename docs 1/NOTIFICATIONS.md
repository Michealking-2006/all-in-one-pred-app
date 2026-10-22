# Push notifications and usage charts

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
