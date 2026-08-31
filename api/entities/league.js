import { footballFetch, apiError } from '../_lib/football.js';

export default async function handler(req, res) {
  const id = req.query?.id;
  const season = req.query?.season;
  if (!id) return res.status(400).json({ error: 'League id is required' });

  try {
    const [league, standings, fixtures, scorers] = await Promise.all([
      footballFetch('/leagues', { id, season }),
      season ? footballFetch('/standings', { league: id, season }) : Promise.resolve(null),
      season ? footballFetch('/fixtures', { league: id, season, last: 5 }) : Promise.resolve(null),
      season ? footballFetch('/players/topscorers', { league: id, season }) : Promise.resolve(null),
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
