# News stories on your own address, and ad / promotion spaces

## What people see
A story in the news list opens **on Scoutwave's own address**, `/news/<headline-words>-<id>` (for example `/news/arsenal-beat-chelsea-2-1-3f2a…`). The page shows the headline, picture, source, time and tags, the publisher's summary, a clear button **"Read the full story on <source>"**, and "More stories". It can be shared (the link is ours) and search engines and link previews get a proper page (headline, summary, image and the link to the source). Only the publisher's summary is shown: the full text stays on their site, which is also where the reader goes next.

An opened story is remembered for the session so it appears instantly; a story opened from a shared link is fetched by id from the news provider (`GET /api/news?id=…`, cached for 6 hours at the edge, one provider request per story). A story the provider no longer has shows "This story is no longer available".

## Placements (ad or promotion spaces)
Admin > Remote config > **News placements** has four spaces, all off until you fill them in and switch them on: in the news list (after the fourth story), top of a story, middle of a story and end of a story. Each has a headline, optional text, a link, a button text, an optional https image and a visible label (Sponsored, Ad, Partner or Promoted) so nobody mistakes it for a story. A space only goes live with a headline and a link; only safe links (https, http, or a path inside the app) and https images are accepted. Changes reach devices within about a minute.

## Run dates and analytics
Each space can have a **start date and an end date** (whole days, UTC, both included; either can be left blank). Outside its dates a space simply disappears, with no gap; admin > Placements shows each space as Live, Starts <date>, Ended <date> or Off.

**admin > Placements** (needs `supabase/migrations/007_placement_stats.sql`) shows, for the last 30 days: views, taps and tap rate in total, per day, per space and per campaign. A **campaign** is one version of a space: changing its headline or link starts a new one, so each version has its own figures (changing only the wording or button text keeps them together).
- A **view** is counted when at least half of the space has been on screen for a second, once per visit. A **tap** is counted when it is tapped (a double tap is one).
- Only counts are stored: no person, device, address or cookie. People whose browser sends Do Not Track or Global Privacy Control are not counted, so real figures are slightly higher.
- Events are accepted only for a space that is on, inside its dates and still has that campaign id; bots are ignored; each address is limited to 60 events a minute. This keeps the figures from being inflated by replayed or invented events, but it is not fraud-proof: treat the numbers as a good estimate when talking to advertisers, not an audited count.
- Mention the counting in your privacy policy (counts of views and taps of promotions, no personal data).

When you later want to link your own articles or a partner feed into these spaces, extend `placement(slot)` in `src/components/Placement.js`; it renders whatever the config provides. Not built yet: picking a different promotion per tag or per club, capping how often one person sees it, and click-through to conversions.
