import { footballFetch, apiError } from '../_lib/football.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id, season } = req.query || {};
  if (!id) return res.status(400).json({ error: 'League id is required' });

  try {
    const params = { league: id, season };
    const [league, standings, fixtures, scorers] = await Promise.all([
      footballFetch('/leagues', { league: id, season }),
      season ? footballFetch('/standings', params) : Promise.resolve(null),
      season ? footballFetch('/fixtures', { league: id, season, last: 5 }) : Promise.resolve(null),
      season ? footballFetch('/players/topscorers', params) : Promise.resolve(null),
    ]);

    return res.status(200).json({
      league: league?.response?.[0] || null,
      standings: standings?.response?.[0]?.league?.standings || [],
      fixtures: fixtures?.response || [],
      scorers: scorers?.response || [],
    });
  } catch (error) {
    const result = apiError(error);
    return res.status(result.status).json(result.body);
  }
}
