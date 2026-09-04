const API = 'https://v3.football.api-sports.io';

// curated set of league ids to surface — API-Football has thousands of
// leagues/cups worldwide, most of them irrelevant to this app, so this
// list controls *which* competitions we show. Everything about each one
// (name, logo, country, flag) is still fetched live from API-Football,
// nothing is hardcoded on the frontend.
const LEAGUE_IDS = [
  39, 40, 45,   // England: Premier League, Championship, FA Cup
  140, 143,     // Spain: La Liga, Copa del Rey
  135, 137,     // Italy: Serie A, Coppa Italia
  78, 79,       // Germany: Bundesliga, 2. Bundesliga
  61, 62,       // France: Ligue 1, Ligue 2
  88,           // Netherlands: Eredivisie
  94,           // Portugal: Primeira Liga
  71,           // Brazil: Serie A
  253,          // United States: MLS
  2, 3, 1,      // International: Champions League, Europa League, World Cup
];

// subset featured in the "Popular competitions" strip
const POPULAR_IDS = new Set([39, 140, 2, 135, 78, 61]);

function toSlug(value) {
  return String(value || '')
    .trim().toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchLeague(id, key) {
  const url = new URL(`${API}/leagues`);
  url.searchParams.set('id', id);

  const response = await fetch(url, {
    headers: { 'x-apisports-key': key, Accept: 'application/json' },
  });

  const data = await response.json().catch(() => ({}));
  const item = data.response?.[0];
  if (!response.ok || !item) return null;

  return {
    id: item.league?.id,
    name: item.league?.name,
    logo: item.league?.logo,
    slug: toSlug(item.league?.name),
    country: item.country?.name || 'International',
    countryCode: (item.country?.code || 'world').toLowerCase(),
    flag: item.country?.flag,
    popular: POPULAR_IDS.has(item.league?.id),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.SCOUTWAVE_FOOTBALL_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Football API is not configured' });
  }

  try {
    const results = await Promise.all(
      LEAGUE_IDS.map((id) => fetchLeague(id, key).catch(() => null))
    );

    const leagues = results.filter(Boolean);

    const countryMap = new Map();
    for (const league of leagues) {
      const key = league.country;
      if (!countryMap.has(key)) {
        countryMap.set(key, {
          name: league.country,
          code: league.countryCode,
          flag: league.flag,
          leagues: [],
        });
      }
      countryMap.get(key).leagues.push({
        id: league.id,
        name: league.name,
        logo: league.logo,
        slug: league.slug,
      });
    }

    const popular = leagues
      .filter((l) => l.popular)
      .map((l) => ({ id: l.id, name: l.name, logo: l.logo, slug: l.slug }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      popular,
      countries: [...countryMap.values()],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to load leagues' });
  }
}
