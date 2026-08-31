import { footballFetch, apiError } from '../_lib/football.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query || {};
  const season = Number(req.query?.season) || new Date().getUTCFullYear();
  if (!id || !/^\d+$/.test(String(id))) return res.status(400).json({ error: 'Valid league id is required' });

  try {
    const params = { league: id, season };
    const [league, standings, fixtures, scorers] = await Promise.all([
      footballFetch('/leagues', { league: id, season }),
      footballFetch('/standings', params),
      footballFetch('/fixtures', { league: id, season, last: 5 }),
      footballFetch('/players/topscorers', params),
    ]);

    const leagueData = league?.response?.[0] || null;
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
