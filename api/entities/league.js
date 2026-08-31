import { footballFetch, apiError } from '../_lib/football.js';

const currentSeason = () => new Date().getUTCFullYear();

async function safe(request, fallback) {
  try {
    return await request();
  } catch {
    return fallback;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query || {};
  const season = Number(req.query?.season) || currentSeason();
  if (!id || !/^\d+$/.test(String(id))) {
    return res.status(400).json({ error: 'Valid league id is required' });
  }

  try {
    const params = { league: id, season };
    const leagueResponse = await footballFetch('/leagues', params);
    const leagueData = leagueResponse?.response?.[0] || null;

    if (!leagueData?.league?.id) {
      return res.status(404).json({ error: 'League not found' });
    }

    const [standings, fixtures, scorers] = await Promise.all([
      safe(() => footballFetch('/standings', params), null),
      safe(() => footballFetch('/fixtures', { league: id, season, last: 5 }), null),
      safe(() => footballFetch('/players/topscorers', params), null),
    ]);

    return res.status(200).json({
      season,
      league: leagueData,
      standings: standings?.response?.[0]?.league?.standings?.[0] || [],
      fixtures: fixtures?.response || [],
      scorers: scorers?.response || [],
    });
  } catch (error) {
    const result = apiError(error);
    return res.status(result.status).json(result.body);
  }
}
