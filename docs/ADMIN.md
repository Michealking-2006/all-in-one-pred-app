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
| **Users** | Everyone who has an account: sign-in method, joined, last seen, confirmed, **Premium and coins**. Grant or revoke Premium (7/30/90/365 days or permanent), add or remove coins (a reason is required and goes in the audit log and the coin ledger), ban (24 h / 7 d / 30 d / permanent) and unban. |
| **Audit log** | Every sign-in and every change, with the time and IP. |

## One-time setup
1. **Database.** In the Supabase SQL editor run `supabase/migrations/001_admin.sql`, then `002_entitlements.sql` (Premium and coins on accounts), and `006_admin_security.sql` (sign-in lockout and sessions; the later migrations 003-005 are for payments, predictions, usage and push). It creates
   `app_config`, `support_messages` and `admin_audit` with Row Level Security **on and no
   policies**, so the browser can read and write nothing; only the server can.
2. **Secrets.** Run `node scripts/admin-setup.mjs "a long passphrase"` and paste the printed lines into
   Vercel (Project Settings, Environment Variables, Production):
   - `ADMIN_PASSWORD_HASH`: scrypt hash of your passphrase (the passphrase itself is never stored)
   - `ADMIN_SESSION_SECRET`: signs session tokens (48+ random characters)
   - `ADMIN_TOTP_SECRET`: two-factor secret; add it to an authenticator app. **Required**: without it nobody can sign in
   - `ADMIN_EMAIL`: optional, also required at sign-in
   - `SUPABASE_SERVICE_ROLE_KEY`: from Supabase, Project Settings, API. **Server only.** Never put it in the app.
   - `SUPABASE_URL`: optional (defaults to the project the app already uses)
3. Redeploy, open `https://your-site/mingt-t`, sign in with the passphrase and the 6-digit code.
   The Overview health checks tell you if anything is missing.

## Security design

**Three layers guard the sign-in:**

1. **Required two-factor, every code works once.** Sign-in needs the passphrase, the optional email *and* a 6-digit authenticator code. There is no way to switch the code off: with no `ADMIN_TOTP_SECRET` the sign-in refuses to start. Each code can be used once, so one that was seen over a shoulder, on a phishing page or in a log cannot be replayed; a reused code is refused and recorded. The error never says which of the three details was wrong.
2. **Lockout that survives restarts.** Failed attempts are counted in the database, not in a server's memory (which serverless resets constantly). 5 failures from one address lock it for 15 minutes, doubling each time it happens again (up to a day), even if the next attempt is correct. 20 failures from anywhere within an hour lock sign-in for everyone for 15 minutes, so spreading guesses over many addresses doesn't help. (During such an attack you may be locked out for those 15 minutes too: that is the price of the overall limit.) Failures are also slowed down, and locks and replayed codes are written to the audit log.
3. **Server-side sessions you can see and end.** Every sign-in creates a session record. A session ends after 30 idle minutes (`ADMIN_IDLE_MINUTES`, 5 to 240) or 8 hours, is tied to the browser that signed in (a stolen token used from a different browser is rejected and the session killed; `ADMIN_BIND_IP=1` ties it to the network as well, which can sign you out when a phone changes network), and can be ended from **Security** in the dashboard: one session, or *Sign out everywhere*. Signing out ends the session on the server, not just in the tab. A token that was never recorded is useless even if forged.

If the database can't be reached **at sign-in** (for instance migration 006 hasn't been run yet) you can still get in, with reduced protection and a visible warning, so a missing migration can never lock the owner out. Once a session exists it is always checked; if the database is unreachable then, the request is refused.

**If you lose your authenticator**, run `node scripts/admin-setup.mjs` again, put the new `ADMIN_TOTP_SECRET` in Vercel and redeploy. There are no recovery codes to leak. Rotating `ADMIN_SESSION_SECRET` also ends every session at once.

**Also in place:**
- A successful sign-in returns an 8-hour HMAC-signed token, kept in `sessionStorage` (gone when
  the tab closes) and sent in an `Authorization` header, never a cookie, so cross-site request
  forgery cannot use it. Tampered, expired or wrong-subject tokens are rejected.
- The API accepts POST only and same-origin requests only, and every action except sign-in needs a valid token.
- All input is validated on the server (known flags only, whole-number prices, semver versions, link
  schemes, length limits). Search terms are stripped of query operators; ids must be integers or UUIDs.
- Text from users is only ever inserted as text, never HTML, so a hostile feedback message cannot run script.
- The service-role key and all secrets exist only on the server and are never returned by any endpoint.
- Other public endpoints (push signup, usage, payments webhook) keep their own small per-instance limits. For a hard
  network-level limit on `/api/mingt` as well, add a Vercel Firewall rate-limit rule.

## Public endpoints it adds
- `GET /api/config`: the live configuration. Cached 30 s at the CDN; browsers always revalidate.
  If the database is down the app silently uses its built-in defaults.
- `POST /api/feedback`: stores a copy of a message in the inbox (5 per IP per 10 minutes, validated).

## Local use
`.env.example` lists every variable. With `vercel dev` the dashboard works at
`http://localhost:3000/mingt-t`.

## Premium and coins on the account
By default Premium and coins live on each phone (a local demo). With the **Account Premium and coins**
flag on (Remote config, off by default) it works like this for **signed-in** users; guests keep the demo:
- The database is the only source of truth (`entitlements`, plus a `coin_ledger` of every movement).
  The app mirrors it, so editing the phone's storage cannot create Premium or coins; the next sync undoes it.
- Spending (unlocking a theme or a tip) is decided on the server: price from Remote config, balance checked,
  charged exactly once even on a double tap or two devices at once (optimistic concurrency), never below zero.
- You grant or revoke Premium and coins in **Users**. Premium can have an end date.
- Buying Premium or coins inside the app goes through Polar: see `docs/PAYMENTS.md`. Until Polar is set up,
  the buy buttons tell signed-in users that payments aren't set up yet; you can still add Premium and coins by hand.
- Signing out clears account Premium and coins from the device.
Turn the flag on only after running migration 002 (Overview shows a green check for it) and granting yourself
Premium to try it.
