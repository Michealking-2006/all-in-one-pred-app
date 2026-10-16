// Hashtags for filtering the news. Shared by the browser (chips, tagging
// articles) and api/news.js (which turns a tag into a TheNewsAPI search, so
// only these queries can ever be sent upstream). Club tag ids match the ids in
// clubTheme.js, so "your club" can be offered first.
export const NEWS_TAGS = [
  { id: "premierleague", label: "PremierLeague", query: '"premier league"', match: /premier league|\bEPL\b/i },
  { id: "laliga", label: "LaLiga", query: '"la liga" | laliga', match: /la\s?liga/i },
  { id: "seriea", label: "SerieA", query: '"serie a"', match: /serie a\b/i },
  { id: "bundesliga", label: "Bundesliga", query: "bundesliga", match: /bundesliga/i },
  { id: "ligue1", label: "Ligue1", query: '"ligue 1"', match: /ligue 1/i },
  { id: "championsleague", label: "ChampionsLeague", query: '"champions league"', match: /champions league/i },
  { id: "europaleague", label: "EuropaLeague", query: '"europa league"', match: /europa league/i },
  { id: "worldcup", label: "WorldCup", query: '"world cup"', match: /world cup/i },
  { id: "transfers", label: "Transfers", query: '"transfer news" | "transfer window" | "transfer target" | "signs for"', match: /transfer|signing|signs for|loan deal/i },
  { id: "arsenal", label: "Arsenal", query: "arsenal", club: true, match: /arsenal/i },
  { id: "chelsea", label: "Chelsea", query: "chelsea", club: true, match: /chelsea/i },
  { id: "liverpool", label: "Liverpool", query: "liverpool", club: true, match: /liverpool/i },
  { id: "man-united", label: "ManUtd", query: '"manchester united"', club: true, match: /manchester united|man utd|man united/i },
  { id: "man-city", label: "ManCity", query: '"manchester city"', club: true, match: /manchester city|man city/i },
  { id: "tottenham", label: "Spurs", query: "tottenham | spurs", club: true, match: /tottenham|\bspurs\b/i },
  { id: "barcelona", label: "Barcelona", query: "barcelona | barça", club: true, match: /barcelona|barça/i },
  { id: "real-madrid", label: "RealMadrid", query: '"real madrid"', club: true, match: /real madrid/i },
  { id: "bayern", label: "Bayern", query: '"bayern munich" | "bayern münchen"', club: true, match: /bayern/i },
  { id: "psg", label: "PSG", query: '"paris saint-germain" | psg', club: true, match: /paris saint-germain|\bPSG\b/i },
  { id: "juventus", label: "Juventus", query: "juventus", club: true, match: /juventus/i },
  { id: "ac-milan", label: "ACMilan", query: '"ac milan"', club: true, match: /ac milan/i },
  { id: "inter", label: "InterMilan", query: '"inter milan"', club: true, match: /inter milan/i },
];

export const tagById = (id) => NEWS_TAGS.find((tag) => tag.id === id) || null;
export const tagQuery = (id) => tagById(id)?.query || null;

// Up to `max` hashtags an article is about, judged from its own words.
export function tagsOf(article, max = 3) {
  const haystack = `${article?.title || ""} ${article?.description || ""}`;
  return NEWS_TAGS.filter((tag) => tag.match.test(haystack)).slice(0, max);
}
