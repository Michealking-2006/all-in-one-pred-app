# Scoutwave

Football livescores, predictions, odds and stats. Vanilla JS PWA (no framework), Supabase auth, API-Football data through a small Vercel serverless proxy.

## Setup

1. In Vercel → Project → Settings → Environment Variables add `SCOUTWAVE_FOOTBALL_API_KEY` (your API-Football key), then redeploy.
2. Locally: copy `.env.example` to `.env`, then run `npm run dev` (uses `vercel dev`, which serves both the app and `/api/football`).
   `npm run dev:static` serves the front end only; data calls will fail without the proxy.

The API key is never sent to the browser. If a key was ever committed or served publicly, rotate it in the API-Football dashboard.

## Layout

- `api/football.js` – allow-listed proxy to API-Football (key from env, edge caching per endpoint).
- `src/api/footballApi.js` – client with TTL cache + request de-duplication (protects your daily quota).
- `src/api/supabase.js` – minimal Supabase auth client (password, Google, recovery, profile update).
- `src/store.js`, `src/router.js`, `src/App.js` – state, path routing, rendering.
- `src/config.js` – public settings (support email, social links, version). Confirm before launch.
- `sw.js`, `manifest.webmanifest`, `icons/` – PWA install + offline shell.

## Still prototype

VIP tips (sample data), coins/premium (free, stored in localStorage), news (sample headlines), language and notification settings (saved, not applied). See CHANGES.md.
