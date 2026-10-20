# Predictions: how Scoutwave's own model works, and how to switch it on

Scoutwave does **not** use API-Football's predictions (the endpoint is removed from the
client and from the `api/football.js` allow-list). Predictions come from our own model in
`src/predictions/`.

## Status
Built and tested, **switched off by default**: the match page shows "Predictions are coming
soon" and the VIP tab shows its sample notice. Turn it on for one device to try it:

- open the app once with `?flag=predictions:on` (use `:off` to undo), or
- `localStorage.setItem("scoutwave.flag.predictions", "on")`

To launch for everyone, set `predictions: true` in `src/features.js` (`FEATURE_DEFAULTS`).

## The model (`src/predictions/model.js`, version `poisson-v1`)
1. From the league table (home and away goals for/against per team) it computes attack and
   defence strengths at home and away, blended toward the league average while a team has
   few games (6 "average" games of prior).
2. Expected goals = league average x attack x opponent defence (home/away aware).
   Recent form (last 5) moves expected goals by at most 8%.
3. A Poisson scoreline grid (0-8 goals each, small Dixon-Coles low-score correction) gives
   win/draw/loss, over/under 2.5, both teams to score and the likeliest score.
4. Confidence is "low" with under 4 home/away games of data or a near coin-flip, "high" at
   55%+ for the favourite.

Cost in API requests: one cached `standings` call per competition (10 min), plus the team
form the match header already loads. Nothing extra per prediction.

## Honest accuracy (`src/predictions/tracker.js`)
Every prediction made **before kick-off** is stored once per fixture and model version
(never after: no hindsight). When the match finishes, it is graded on the 90-minute result:
winner, over/under 2.5, both teams to score, and the Brier score for the 1X2 probabilities.
`accuracySummary()` feeds the "Tracked accuracy" card on the VIP tab. Storage is local to
the device today; the record shape is flat so it can move to a server table unchanged.

## Server-side tracking (0.20.0)

A scheduled job now records a prediction for **every** upcoming match, so accuracy covers all of them and the app shows exactly what was recorded. Setup is in the section "Switching on server-side tracking" below; everything is in `api/_predict.js`, `api/_report.js`, `api/cron.js` and the admin **Predictions** page.

**What runs** (Vercel cron, see `vercel.json`; Vercel's Hobby plan allows one run per day per job):
- `04:30 UTC grade`: fetches finished matches and grades each recorded prediction on the 90-minute score (not extra time).
- `06:00 UTC predict`: fetches today's and tomorrow's not-started fixtures, one standings call per competition (largest first), and records a prediction for each at least 10 minutes before kick-off. **The first prediction for a match and model version is final** and never overwritten, so there is no hindsight.

**API cost.** Hard-capped per run by `PREDICT_MAX_CALLS` (40) and by `PREDICT_QUOTA_SHARE` (35%) of what is left of today's quota, whichever is smaller; if less than 3 calls are affordable the run does nothing. Typical run: 2 fixture calls plus 1 per competition (plus odds if `PREDICT_ODDS=1`). Recent form is free: it comes from the standings rows.

**What is stored** (`supabase/migrations/004_predictions.sql`): the prediction as the app shows it, the full 9x9 score matrix, the unrounded probabilities used for scoring, a snapshot of the inputs, and the grade. Stored inputs are what a future ratings model will be trained and back-tested on.

**What is measured** (admin > Predictions, and `GET /api/accuracy` once `PREDICT_MIN_PUBLISH` matches (default 200) are graded): winner accuracy, over/under 2.5 and both-teams-to-score accuracy, Brier score, log loss, exact score, real score in the top 3 and top 5, and calibration tables ("when we said 60%, how often did it happen?"). Guessing scores are 0.667 Brier and 1.099 log loss for 1X2.

**Benchmarks, same matches, same scoring.**
- *Bookmaker market* (`PREDICT_ODDS=1`): odds from one bookmaker, margin removed. This is the strongest yardstick there is: a model that can't beat or match the closing market has no edge. The edge and a quarter-Kelly figure are stored for the admin only; the app never shows stakes or betting advice.
- *Forebet*: not read automatically. Scoutwave does not scrape Forebet: it breaks their terms, breaks without warning, and would mean republishing their numbers. Instead, type in what their public page showed **before kick-off** for a sample of matches (admin > Predictions); lines entered after kick-off are kept but never counted.

**OpenAI** (optional, `OPENAI_API_KEY`, `PREDICT_EXPLAIN_MAX`): writes a one-or-two-sentence plain-language note for the most confident matches. It is given only our numbers, may not invent injuries or news, and **never changes a probability**. A language model is a poor source of probabilities (it can't be calibrated or back-tested the way a statistical model can), so it is used where it is good: wording.

**Honest scope: what is not built yet** (your lists, mapped to what the data allows):

| Item | Status |
|---|---|
| Attack/defence, home/away strength, league scoring baseline, Poisson, Dixon-Coles low-score correction, score matrix, 1X2, O/U 2.5, BTTS, correct score top 1/3/5, confidence class | **Built** (poisson-v1) |
| Recent form weighting | Built, small (last 5, max 8%) |
| Odds comparison, value, fractional Kelly | **Built** (admin only) |
| Calibration *measurement* | **Built**; correcting for it waits for data |
| Benchmarks vs market and Forebet | **Built** (Forebet by hand) |
| Elo, time decay, strength of schedule, opponent-adjusted xG, H2H, injuries, goalkeeper, lineup impact, weather, HT/FT, correct-score ensembles, Monte Carlo, ML ensemble, walk-forward retraining | **Not yet.** They need match history the app doesn't hold today (API-Football's xG is not available for most competitions, and head-to-head and injuries cost one call per match). The tracking job stores today's inputs and results so these can be trained and back-tested; add each as its own small tested change with a new `MODEL_VERSION`, kept only if it beats `poisson-v1` on log loss over the same matches. |

## Switching on server-side tracking
1. Run `supabase/migrations/004_predictions.sql` in the Supabase SQL editor.
2. In Vercel add `CRON_SECRET` (any long random string, 16+ characters) and redeploy. Optional: `PREDICT_LEAGUES`, `PREDICT_ODDS=1`, `OPENAI_API_KEY` + `PREDICT_EXPLAIN_MAX`, see `.env.example`.
3. Admin > Overview should show "Server-side prediction tracking" green. In admin > Predictions press *Record predictions now* to try it without waiting for 06:00 UTC.
4. Predictions stay hidden from users until the **Predictions** flag is turned on (Admin > Remote config). Turn it on once you have a few days of graded matches.
5. Locking: the app still decides what is locked (Premium / coins). `GET /api/predictions` is public, so a technical user could read locked picks from it. If locked picks must be strictly private, the endpoint has to check Premium or the coin unlock on the server: say so and that is the next change.

## Suggested next steps (in order of value)
1. ~~Server-side tracking~~ (done in 0.20.0). Publish the running accuracy only once it has a meaningful sample.
2. **Calibrate.** Compare predicted vs actual frequencies (e.g. all "60%" picks should win
   about 60%) and adjust `PRIOR_GAMES`, `RHO` and the home-advantage implied by the table.
3. **Better inputs.** Opponent-adjusted form, rest days, injuries and suspensions, and
   head to head. Add each as its own small, tested multiplier and keep `MODEL_VERSION`
   bumped so old and new predictions are graded separately.
4. **Ratings model.** Replace table goals with an Elo/Dixon-Coles rating fitted on several
   seasons of results (also covers cups and the start of a season).
5. **Premium wiring.** Decide what is free and what is locked (the VIP feed already locks
   per match through `isUnlocked`).

## Tests
Run `node` against the model in isolation: it has no DOM and no network, so it is easy to
test (probabilities sum to 100, stronger sides are favoured, thin data is shrunk, missing
data returns `null`, tracker never records after kick-off, extra time is ignored).
