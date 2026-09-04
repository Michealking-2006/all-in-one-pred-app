const API = 'https://v3.football.api-sports.io';

// keep in sync with the LEAGUE_IDS list in api/leagues/list.js
const LEAGUE_IDS = new Set([
  39, 40, 45,   // England
  140, 143,     // Spain
  135, 137,     // Italy
  78, 79,       // Germany
  61, 62,       // France
  88,           // Netherlands
  94,           // Portugal
  71,           // Brazil
  253,          // United States
  2, 3, 1,      // International
]);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.SCOUTWAVE_FOOTBALL_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Football API is not configured' });
  }

  const requestedDate = String(req.query?.date || '');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : new Date().toISOString().slice(0, 10);

  try {
    const url = new URL(`${API}/fixtures`);
    url.searchParams.set('date', date);

    const response = await fetch(url, {
      headers: { 'x-apisports-key': key, Accept: 'application/json' },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Unable to load fixtures' });
    }

    const all = Array.isArray(data.response) ? data.response : [];

    const fixtures = all
      .filter((f) => LEAGUE_IDS.has(f.league?.id))
      .map((f) => ({
        id: f.fixture?.id,
        date: f.fixture?.date,
        status: f.fixture?.status?.short,
        league: {
          id: f.league?.id,
          name: f.league?.name,
          logo: f.league?.logo,
        },
        teams: f.teams,
        goals: f.goals,
        score: f.score,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ date, fixtures });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Fixtures request failed' });
  }
}
