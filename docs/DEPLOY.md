# Deployment and the 12-function limit

Vercel's free (Hobby) plan allows **at most 12 serverless functions per deployment**, and every file in `api/` whose name doesn't start with an underscore counts as one. Past 12 the whole deployment fails with "No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan". The project had grown to 22; it is now **8**, with room for a few more.

## How it is organised
| Where | What |
|---|---|
| `api/*.js` (no underscore) | The 8 functions: `football`, `mingt` (admin), `cron`, `polar-webhook` (needs the raw request body, so it stays alone), `image-proxy`, `seo` (crawler pages and sitemap/feed/robots/llms), `public` and `account` |
| `api/_*.js` | Shared helpers (database access, accounts, jobs). The underscore keeps Vercel from turning them into functions |
| `server/*.js` | The actual handlers for the small endpoints: config, news, predictions, accuracy, usage, placement-event, csp-report, feedback, push, me, spend, checkout, sitemap, feed, robots, llms |

`api/public.js`, `api/account.js` and `api/seo.js` are small entry points that load the right handler from `server/` on demand. The addresses did **not** change: `vercel.json` rewrites `/api/config` to `/api/public?route=config`, `/api/me` to `/api/account?route=me`, `/sitemap.xml` to `/api/seo?doc=sitemap`, and so on, so the app, the admin and the search engines call the same URLs as before.

## Adding an endpoint
1. Write the handler in `server/<name>.js` (`export default async function handler(req, res)`).
2. Add one line to the route table in `api/public.js` (or `api/account.js` for signed-in endpoints) and one rewrite in `vercel.json` (`/api/<name>` to `/api/public?route=<name>`).
3. Run `npm test`. `tests/deploy.test.mjs` fails if the number of functions would pass 10, if an address the app calls has nothing behind it, if a rewrite points at a missing route, or if a module no longer loads.

Do **not** add a new file to `api/` for a small endpoint. A handler that needs its own settings (a raw body, a long time limit) can be a separate function: keep an eye on the count (the test warns at 10).

## If you move to Vercel Pro
The limit goes away, but nothing here needs undoing: the structure works on any plan.
