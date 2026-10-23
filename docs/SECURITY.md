# Security: injection and cross-site scripting

## What was checked, and what was found
There is **no hand-written SQL** in Scoutwave. Data is read and written through Supabase's REST layer (PostgREST), so "SQL injection" here means smuggling extra filters into a query string (an id such as `1&user_id=neq.0`, a search term such as `x),or=(id.not.is.null`). Every database call in `api/` was reviewed. The old code already validated most values (UUID checks, numeric parsing, a character whitelist for search), so **no exploitable injection was found**. It has still been made structural:

- `api/_query.js` is the only way an outside value may enter a database URL. Its helpers (`q.uuid`, `q.int`, `q.ints`, `q.day`, `q.iso`, `q.word`, `q.text`, `q.like`) return a safe value or refuse with a 400. Every call site now uses them.
- `tests/security.test.mjs` **fails the build if any file in `api/` builds a database URL another way**, and throws injection payloads at every helper. A future change can't quietly reintroduce the problem.
- Writes use JSON bodies (never string-built), tables have row-level security on with no public policies, and only the server holds the service key.

For cross-site scripting (XSS) the review found three real gaps, now closed:

1. **No Content-Security-Policy on the app** (only the admin had one). The app now sends one on every page except the admin area (`vercel.json`): only its own scripts run (`script-src 'self'`, no inline code, no `eval`), no plugins or `<base>` tricks, nobody can frame it, forms go only to itself and Formspree, and connections go only to itself, Supabase and Formspree. Even if markup were ever injected, the browser refuses to run it.
2. **Links and images from outside weren't checked.** A news provider, a remote notice or an ad could have supplied `javascript:` or `data:` URLs. Now `src/utils/safeUrl.js` accepts only web, mail, phone and in-app links (images: https or safe `data:image`, never SVG), and the `h()` helper that builds every element in the app applies it to `href`, `src`, `action` and similar attributes, drops string `on...=` handlers, `srcdoc`, `innerHTML` and string `style`, and adds `noopener noreferrer` to new-tab links. The news server applies the same checks and caps lengths before data reaches the app, and the admin only accepts safe links and https images for ad placements.
3. **Inline code in `index.html`** (two scripts, inline styles and an `onclick`) would have blocked a strict policy. They moved to `src/boot/` and `src/styles/boot.css`.

Already good and kept: all app text is inserted as text nodes (never HTML), the crawler pages in `api/seo.js` escape everything and escape `<` inside JSON-LD, and the admin has its own strict policy and three-layer sign-in (`docs/ADMIN.md`).

## Keeping it that way
- `npm test` runs the whole suite. The security tests also scan the source for HTML-writing sinks (`innerHTML =`, `eval`, `document.write`, string timers, `setAttribute("style")`) and for inline scripts or styles in `index.html`.
- Use `q.*` for every database value, `h()` for every element, and `textContent` / text nodes for every piece of outside text.

## After deploying
The policy is **enforced**. Open the app once on a phone and a computer and click through Home, a match, News, a story, Share and Premium. Browsers report anything the policy blocks to `/api/csp-report`, and admin > Security shows the counts (a healthy site shows none). If something legitimate is blocked, find the rule in `vercel.json` and add the origin; to switch the policy to "report only" while you investigate, rename the header `Content-Security-Policy` to `Content-Security-Policy-Report-Only`.

What this does **not** cover: Vercel, Supabase and your other providers' own security; the strength of your passwords and keys; and a compromised dependency (the only runtime dependency is `web-push`, used on the server).
