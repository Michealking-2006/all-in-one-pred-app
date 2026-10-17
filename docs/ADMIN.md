# Admin dashboard (`/mingt-t`)

The control room lives at **`/mingt-t`** (not `/admin`). It is a separate page: it adds nothing
to the app's size, is never cached by the service worker, is marked `noindex`, is disallowed in
`robots.txt`, and is served with a strict content-security policy and `no-store`.

The URL is only obscurity. The protection is the sign-in and the server checks described below.

## What it does
| Section | What you can do |
|---|---|
| **Overview** | App version and deploy, registered users, new messages, the football API's daily quota (read from the provider's free `/status` call), health checks for every service and secret, and what is live right now. |
| **Remote config** | Change the app for everyone within about a minute, no deploy: turn **predictions** on/off, the **advanced themes kill switch**, **maintenance mode** (replaces the app with your message), an **announcement banner** (info/warning/good news, optional link, optional expiry, dismissible; editing it shows it again to everyone), a **minimum app version** (older devices are asked to update), and the **theme coin prices**. A publish confirmation lists exactly what changes. |
| **Messages** | Inbox for every feedback, issue and contact message (a copy is stored when a user submits; Formspree still emails you). Filter, search, mark read/resolved, private notes, reply by email, delete. |
| **Users** | Everyone who has an account: sign-in method, joined, last seen, confirmed. Ban (24 h / 7 d / 30 d / permanent) and unban. |
| **Audit log** | Every sign-in and every change, with the time and IP. |

## One-time setup
1. **Database.** In the Supabase SQL editor run `supabase/migrations/001_admin.sql`. It creates
   `app_config`, `support_messages` and `admin_audit` with Row Level Security **on and no
   policies**, so the browser can read and write nothing; only the server can.
2. **Secrets.** Run `node scripts/admin-setup.mjs "a long passphrase"` and paste the printed lines into
   Vercel (Project Settings, Environment Variables, Production):
   - `ADMIN_PASSWORD_HASH`: scrypt hash of your passphrase (the passphrase itself is never stored)
   - `ADMIN_SESSION_SECRET`: signs session tokens (48+ random characters)
   - `ADMIN_TOTP_SECRET`: two-factor secret; add it to an authenticator app (strongly recommended)
   - `ADMIN_EMAIL`: optional, also required at sign-in
   - `SUPABASE_SERVICE_ROLE_KEY`: from Supabase, Project Settings, API. **Server only.** Never put it in the app.
   - `SUPABASE_URL`: optional (defaults to the project the app already uses)
3. Redeploy, open `https://your-site/mingt-t`, sign in with the passphrase and the 6-digit code.
   The Overview health checks tell you if anything is missing.

## Security design
- Sign-in uses a scrypt-hashed passphrase, an optional email and an optional TOTP code; all three
  are always checked and the error never says which was wrong.
- 5 failed attempts lock that IP out for 15 minutes; failures are also slowed down.
- A successful sign-in returns an 8-hour HMAC-signed token. It is kept in `sessionStorage` (gone when
  the tab closes) and sent in an `Authorization` header, never a cookie, so cross-site request
  forgery cannot use it. Tampered, expired or wrong-subject tokens are rejected.
- The API accepts POST only and same-origin requests only, and every action except sign-in needs a valid token.
- All input is validated on the server (known flags only, whole-number prices, semver versions, link
  schemes, length limits). Search terms are stripped of query operators; ids must be integers or UUIDs.
- Text from users is only ever inserted as text, never HTML, so a hostile feedback message cannot run script.
- The service-role key and all secrets exist only on the server and are never returned by any endpoint.
- Rate limits are per server instance (best effort on serverless). For stronger protection add Vercel's
  Firewall rate-limit rule for `/api/mingt`.

## Public endpoints it adds
- `GET /api/config`: the live configuration. Cached 30 s at the CDN; browsers always revalidate.
  If the database is down the app silently uses its built-in defaults.
- `POST /api/feedback`: stores a copy of a message in the inbox (5 per IP per 10 minutes, validated).

## Local use
`.env.example` lists every variable. With `vercel dev` the dashboard works at
`http://localhost:3000/mingt-t`.
