// /llms.txt: a plain summary of the site for AI assistants and answer engines (an emerging convention; no
// search engine has promised to use it, so treat it as a cheap extra, not a ranking lever).
import { siteOrigin, TOP_LEAGUES, slugOf } from "../api/_site.js";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "../src/seoCore.js";

export default function handler(req, res) {
  const o = siteOrigin(req);
  const text = `# ${SITE_NAME}

> ${DEFAULT_DESCRIPTION}

${SITE_NAME} shows live football scores, fixtures, league tables, lineups, match statistics and odds, club and player pages, and football news summaries that link to the original publishers.

## Main pages
- [Livescores](${o}/livescores): live football scores, today's results and upcoming fixtures
- [Football predictions](${o}/predictions): match predictions for today and the coming days, graded after every game
- [Leagues](${o}/leagues): competitions, tables and fixtures
- [News](${o}/news): headlines with summaries and links to the full stories

## Competitions
${TOP_LEAGUES.map(([id, name]) => `- [${name}](${o}/league/${slugOf(id, name)})`).join("\n")}

## Pages for machines
- [Sitemap](${o}/sitemap.xml)
- [News feed (RSS)](${o}/feed.xml)

## Notes
- Scores and tables come from a licensed football data provider and are updated as matches happen.
- News pages carry the publisher's summary only; follow the link on each page for the full story.
- Predictions are statistical estimates, not betting advice.
`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
  res.status(200).send(text);
}
