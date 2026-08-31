const cache = new Map();

function normalizeSlug(value) {
  return decodeURIComponent(String(value || ''))
    .trim().toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugFromPath(path = location.pathname) {
  const parts = String(path).split('/').filter(Boolean);
  return parts.length >= 2 ? normalizeSlug(parts[1]) : '';
}

function mapEntryToId(entry) {
  if (typeof entry === 'number') return entry;
  if (typeof entry === 'string' && /^\d+$/.test(entry)) return Number(entry);
  if (entry && typeof entry === 'object') return entry.id ?? entry.leagueId ?? entry.apiFootballId ?? null;
  return null;
}

async function loadLeagueMap() {
  if (cache.has('league-map')) return cache.get('league-map');
  const promise = fetch('/assets/data/leagues.json', { headers: { Accept: 'application/json' } })
    .then((r) => { if (!r.ok) throw new Error(`Unable to load leagues (${r.status})`); return r.json(); })
    .then((data) => {
      const map = new Map();
      if (Array.isArray(data)) {
        for (const item of data) {
          const slug = normalizeSlug(item?.slug || item?.key || item?.name);
          const id = mapEntryToId(item);
          if (slug && id) map.set(slug, id);
        }
      } else if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          const id = mapEntryToId(value);
          if (id) map.set(normalizeSlug(key), id);
          if (value && typeof value === 'object' && value.slug && id) map.set(normalizeSlug(value.slug), id);
        }
      }
      return map;
    });
  cache.set('league-map', promise);
  return promise;
}

export async function resolveEntity({ type, slug = slugFromPath() }) {
  const normalizedType = String(type || '').toLowerCase();
  const normalizedSlug = normalizeSlug(slug);
  if (!['league', 'club', 'player'].includes(normalizedType)) throw new Error('Unsupported entity type');
  if (!normalizedSlug) throw new Error('Entity slug is required');

  if (normalizedType === 'league') {
    const map = await loadLeagueMap();
    const id = map.get(normalizedSlug);
    if (!id) throw new Error('League not found');
    return { type: normalizedType, slug: normalizedSlug, id };
  }

  return { type: normalizedType, slug: normalizedSlug, id: null };
}

export { normalizeSlug, slugFromPath };
