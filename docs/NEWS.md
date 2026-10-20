# News stories on your own address, and ad / promotion spaces

## What people see
A story in the news list opens **on Scoutwave's own address**, `/news/<headline-words>-<id>` (for example `/news/arsenal-beat-chelsea-2-1-3f2a…`). The page shows the headline, picture, source, time and tags, the publisher's summary, a clear button **"Read the full story on <source>"**, and "More stories". It can be shared (the link is ours) and search engines and link previews get a proper page (headline, summary, image and the link to the source). Only the publisher's summary is shown: the full text stays on their site, which is also where the reader goes next.

An opened story is remembered for the session so it appears instantly; a story opened from a shared link is fetched by id from the news provider (`GET /api/news?id=…`, cached for 6 hours at the edge, one provider request per story). A story the provider no longer has shows "This story is no longer available".

## Placements (ad or promotion spaces)
Admin > Remote config > **News placements** has four spaces, all off until you fill them in and switch them on: in the news list (after the fourth story), top of a story, middle of a story and end of a story. Each has a headline, optional text, a link, a button text, an optional https image and a visible label (Sponsored, Ad, Partner or Promoted) so nobody mistakes it for a story. A space only goes live with a headline and a link; only safe links (https, http, or a path inside the app) and https images are accepted. Changes reach devices within about a minute.

When you later want to link your own articles or a partner feed into these spaces, that is the place to extend: the `placement(slot)` component (`src/components/Placement.js`) renders whatever the config provides. Not built yet: impression and click counts per placement, scheduling by date, and picking a different placement per tag.
