const cache = new Map();

function normalizeSlug(value) {
  return decodeURIComponent(String(value || ''))
    .trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function slugFromPath(path = location.pathname) {
  const parts = String(path).split('/').filter(Boolean);
  return parts.length === 1 ? normalizeSlug(parts[0]) : '';
}

async function footballLookup(slug) {
  const url = new URL('/api/entities/resolve', location.origin);
  url.searchParams.set('slug', slug);
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Entity lookup failed');
  return data;
}

export async function resolveEntity({ slug = slugFromPath() } = {}) {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) throw new Error('Entity slug is required');
  const key = normalizedSlug;
  if (!cache.has(key)) cache.set(key, footballLookup(normalizedSlug));
  try { return await cache.get(key); }
  catch (error) { cache.delete(key); throw error; }
}

export function clearEntityCache(slug) {
  if (slug) cache.delete(normalizeSlug(slug));
  else cache.clear();
}

export { normalizeSlug, slugFromPath };