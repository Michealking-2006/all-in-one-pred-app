const state = { controller: null, mounted: false };

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = (value) => value == null ? '—' : String(value);

function slugFromLocation() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function getLeagueId(slug) {
  const map = window.LEAGUES || window.leaguesMap || {};
  const value = map[slug];
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') return value.id ?? value.leagueId ?? null;
  return null;
}

function renderStandings(groups) {
  const rows = Array.isArray(groups) ? groups.flat() : [];
  if (!rows.length) return '<p class="entity-state">Standings are not available for this season.</p>';
  return `<div class="league-standings-table" role="table" aria-label="League standings">
    <div class="league-standing-row league-standing-head" role="row"><span>#</span><span>Team</span><span>MP</span><span>W</span><span>D</span><span>L</span><span>Pts</span></div>
    ${rows.map((item, i) => { const t = item.team || {}; const f = item.all || {}; return `<a class="league-standing-row" href="/club/${esc(t.id)}" role="row"><span>${esc(item.rank ?? i + 1)}</span><span class="league-team"><img src="${esc(t.logo || '')}" alt="" loading="lazy"><strong>${esc(t.name || 'Unknown')}</strong></span><span>${esc(f.played ?? 0)}</span><span>${esc(f.win ?? 0)}</span><span>${esc(f.draw ?? 0)}</span><span>${esc(f.lose ?? 0)}</span><strong>${esc(item.points ?? 0)}</strong></a>`; }).join('')}
  </div>`;
}

function renderFixtures(fixtures) {
  if (!fixtures?.length) return '<p class="entity-state">No recent fixtures available.</p>';
  return `<div class="league-fixtures">${fixtures.map((m) => { const h = m.teams?.home || {}; const a = m.teams?.away || {}; const date = m.fixture?.date ? new Date(m.fixture.date).toLocaleDateString() : '—'; return `<article class="league-fixture"><time>${esc(date)}</time><div><span>${esc(h.name || 'Home')}</span><strong>${esc(m.goals?.home ?? '—')} – ${esc(m.goals?.away ?? '—')}</strong><span>${esc(a.name || 'Away')}</span></div></article>`; }).join('')}</div>`;
}

function renderScorers(scorers) {
  if (!scorers?.length) return '<p class="entity-state">Top scorers are not available.</p>';
  return `<div class="league-scorers">${scorers.slice(0, 10).map((item) => { const p = item.player || {}; const s = item.statistics?.[0] || {}; return `<a class="league-scorer" href="/player/${esc(p.id)}"><span>${esc(p.name || 'Player')}</span><small>${esc(s.goals?.total ?? 0)} goals</small></a>`; }).join('')}</div>`;
}

async function load(root, id, season) {
  state.controller?.abort();
  state.controller = new AbortController();
  root.setAttribute('aria-busy', 'true');
  root.innerHTML = '<div class="entity-loading">Loading league…</div>';
  try {
    const response = await fetch(`/api/entities/league?id=${encodeURIComponent(id)}&season=${encodeURIComponent(season)}`, { signal: state.controller.signal, headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to load league');
    const league = data.league?.league || {};
    const country = data.league?.country || {};
    root.innerHTML = `<header class="entity-header"><button class="entity-back" type="button" data-entity-back aria-label="Go back">‹</button><div class="entity-logo-wrap"><img class="entity-logo" src="${esc(league.logo || '')}" alt="" loading="eager"></div><div class="entity-heading"><h1>${esc(league.name || 'League')}</h1><p>${esc(country.name || '—')}</p><p>Season ${esc(season)}</p></div></header><section class="entity-content"><section><h2>Standings</h2>${renderStandings(data.standings)}</section><section><h2>Recent fixtures</h2>${renderFixtures(data.fixtures)}</section><section><h2>Top scorers</h2>${renderScorers(data.scorers)}</section></section>`;
    root.querySelector('[data-entity-back]')?.addEventListener('click', () => history.back());
  } catch (error) {
    if (error.name === 'AbortError') return;
    root.innerHTML = `<section class="entity-content"><p class="entity-state">${esc(error.message)}</p><button type="button" data-entity-retry>Try again</button></section>`;
    root.querySelector('[data-entity-retry]')?.addEventListener('click', () => load(root, id, season));
  } finally { root.removeAttribute('aria-busy'); }
}

export function mountLeagueEntity(root, { id, season } = {}) {
  if (!root || state.mounted) return () => {};
  const slug = slugFromLocation();
  const leagueId = id || getLeagueId(slug);
  const currentSeason = season || new Date().getUTCFullYear();
  if (!leagueId) { root.innerHTML = '<section class="entity-content"><p class="entity-state">League not found.</p></section>'; return () => {}; }
  state.mounted = true;
  load(root, leagueId, currentSeason);
  return () => { state.controller?.abort(); state.controller = null; state.mounted = false; root.replaceChildren(); };
}
