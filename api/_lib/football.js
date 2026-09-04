const API_BASE = 'https://v3.football.api-sports.io';

function getApiKey() {
  const key = process.env.SCOUTWAVE_FOOTBALL_API_KEY;
  if (!key) throw new Error('SCOUTWAVE_FOOTBALL_API_KEY is not configured');
  return key;
}

export async function footballFetch(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    headers: { 'x-apisports-key': getApiKey() },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || `Football API request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function apiError(error) {
  const status = Number(error?.status) || 500;
  return {
    status: status >= 400 && status < 600 ? status : 500,
    body: { error: error?.message || 'Unable to load football data' },
  };
}
