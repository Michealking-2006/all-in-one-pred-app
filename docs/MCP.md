# MCP server

Scoutwave answers the Model Context Protocol, so an AI assistant can ask it for football data directly.

- **Address:** `https://<your domain>/mcp` (also `/api/mcp`). Streamable HTTP, JSON-RPC over `POST`, stateless: no session, no stream, nothing stored.
- **Code:** `server/mcp.js`, reached through `api/public.js` (`route=mcp`), so it uses **no extra serverless function** (the plan allows 12, `tests/deploy.test.mjs` keeps 2 spare).
- **No dependencies.** Protocol versions 2025-06-18, 2025-03-26 and 2024-11-05.

## How it works

Every tool calls Scoutwave's own public endpoints (`/api/football`, `/api/predictions`, `/api/accuracy`, `/api/news`, `/api/config`) through the public address, never a provider directly. So the MCP server inherits everything the app already does: the provider key stays on the server, repeat questions are answered by the shared edge cache, the circuit breaker and the quota floor protect the daily football allowance, and the prediction gate still decides who sees a pick. It reads, it never writes.

## Tools (all read-only)

| Tool | What it returns |
| --- | --- |
| `search` | ids of leagues, teams, venues or players (players need a `league`) |
| `get_matches` | a day's matches (default today), everything live, or a team's next/last N |
| `get_match_details` | one match: score, events, lineups with formations, statistics |
| `get_standings` | league table (groups for cups) |
| `get_top_players` | top scorers, assists, yellow or red cards |
| `get_head_to_head` | past meetings and a tally |
| `get_injuries` | out or doubtful players for a team, match or league |
| `get_odds` | main-market bookmaker odds (information only) |
| `get_predictions` | Scoutwave's stored predictions for up to 60 matches |
| `get_prediction_accuracy` | tracked accuracy (progress until enough matches are graded) |
| `get_news` | football stories, optionally by `#tag` |
| `get_app_status` | maintenance and the current announcement |

Bad arguments come back as a readable tool error (`isError: true`), not a crash, and nothing reaches the backend unchecked. Answers are trimmed (no logos or coverage tables) and long lists are capped with a `truncated` flag.

## Predictions and sign-in

When the `serverEntitlements` flag is on, a pick is only returned for a Premium account or a match the account unlocked; everyone else gets `locked` with just the confidence and rank. A client that can send headers may add the user's Scoutwave sign-in as `Authorization: Bearer <token>`; `get_predictions` (and only that tool) forwards it. Without it, you see exactly what an anonymous visitor sees.

## Protection

- 60 tool calls per IP per minute (`MCP_RATE_PER_MIN`), then HTTP 429 with `Retry-After`. Counted per server instance, like `/api/usage`.
- `MCP_DISABLED=1` switches the endpoint off (404) without a deploy of code.
- Cross-origin calls are allowed (nothing uses cookies), so browser tools such as MCP Inspector work.
- The address it calls comes from `SITE_URL`, or the request's own host if that is not set (a host that is not a plain hostname is refused).

## Try it

```bash
curl -s https://YOUR-DOMAIN/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

npx @modelcontextprotocol/inspector      # transport: Streamable HTTP, URL: https://YOUR-DOMAIN/mcp
```

- **Claude:** Settings > Connectors > Add custom connector > `https://YOUR-DOMAIN/mcp`.
- **Claude Code:** `claude mcp add --transport http scoutwave https://YOUR-DOMAIN/mcp` (add `--header "Authorization: Bearer <token>"` to unlock predictions).
- **Cursor / others:** a remote server of type `http` with the same URL.

On a Vercel preview with Deployment Protection on, the server cannot reach its own address; test on the production domain.

## Tests

`tests/mcp.test.mjs` (in `npm test`) uses a fake backend: protocol handling, argument checks, each tool's question and trimming, error handling, the rate limit, and the wiring (route, rewrite order, no extra function).
