const API_BASE = 'https://v3.football.api-sports.io';

const normalize = value => String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const aliases = { 'la-liga': 'laliga', 'la-liga-santander': 'laliga', 'premier-league': 'premier-league' };

function key() {
  const value = process.env.SCOUTWAVE_FOOTBALL_API_KEY;
  if (!value) throw Object.assign(new Error('Football API is not configured'), { status: 500 });
  return value;
}

async function api(path, params) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && url.searchParams.set(k, v));
  const response = await fetch(url, { headers: { 'x-apisports-key': key() } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message || 'Football API request failed'), { status: response.status });
  return data.response || [];
}

const findBySlug = (items, slug, fields) => items.find(item => fields.some(field => normalize(item?.[field]) === slug));

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const type = normalize(req.query?.type);
  const requested = normalize(req.query?.slug);
  const slug = aliases[requested] || requested;
  if (!['league', 'club', 'player'].includes(type) || !slug) return res.status(400).json({ error: 'Valid type and slug are required' });

  try {
    let entity;
    if (type === 'league') {
      const items = await api('/leagues', {});
      const hit = findBySlug(items, slug, ['name', 'slug']);
      if (!hit) return res.status(404).json({ error: 'League not found' });
      entity = { type, id: hit.league.id, slug, name: hit.league.name, logo: hit.league.logo, country: hit.country?.name || null };
    } else if (type === 'club') {
      const items = await api('/teams', { search: requested.replace(/-/g, ' ') });
      const hit = items.find(item => normalize(item.team?.name) === slug) || items[0];
      if (!hit) return res.status(404).json({ error: 'Club not found' });
      entity = { type, id: hit.team.id, slug, name: hit.team.name, logo: hit.team.logo, country: hit.team.country || null };
    } else {
      const items = await api('/players', { search: requested.replace(/-/g, ' '), page: 1 });
      const hit = items.find(item => normalize(item.player?.name) === slug) || items[0];
      if (!hit) return res.status(404).json({ error: 'Player not found' });
      entity = { type, id: hit.player.id, slug, name: hit.player.name, photo: hit.player.photo, nationality: hit.player.nationality || null };
    }
    return res.status(200).json(entity);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Entity resolution failed' });
  }
}
