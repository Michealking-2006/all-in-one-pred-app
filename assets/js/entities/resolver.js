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

async function footballLookup(type, slug) {
  const url = new URL('/api/entities/resolve', location.origin);
  url.searchParams.set('type', type);
  url.searchParams.set('slug', slug);
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Entity lookup failed');
  return data;
}

export async function resolveEntity({ type, slug = slugFromPath() }) {
  const normalizedType = String(type || '').toLowerCase();
  const normalizedSlug = normalizeSlug(slug);
  if (!['league', 'club', 'player'].includes(normalizedType)) throw new Error('Unsupported entity type');
  if (!normalizedSlug) throw new Error('Entity slug is required');

  const key = `${normalizedType}:${normalizedSlug}`;
  if (!cache.has(key)) cache.set(key, footballLookup(normalizedType, normalizedSlug));
  try { return await cache.get(key); }
  catch (error) { cache.delete(key); throw error; }
}

export { normalizeSlug, slugFromPath };
