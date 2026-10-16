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

## Suggested next steps (in order of value)
1. **Server-side tracking.** A Supabase table `predictions(fixture_id, model, made_at, kickoff,
   probs jsonb, pick, over25, btts, xg jsonb, result jsonb)` written from a scheduled
   function once a day for the next 48 hours of fixtures, so accuracy is measured across
   *all* matches, not just ones a user opened. Publish the running accuracy only once it
   has a meaningful sample (a few hundred matches).
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
