import { resolveEntity } from './resolver.js';

const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

const toSlug = v => String(v ?? '')
  .trim().toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const entityLink = (id, name, slug) =>
  id && name
    ? `<a class="entity-link" href="/${encodeURIComponent(slug || toSlug(name))}">${esc(name)}</a>`
    : esc(name || '—');

let activeCleanup = null;

/*********************
 * templates
 *********************/

const templateCache = new Map();

async function fetchTemplate(type) {
  if (templateCache.has(type)) return templateCache.get(type);

  const promise = (async () => {
    const response = await fetch(`/pages/entities/${type}.html`, {
      headers: { Accept: 'text/html' },
    });

    if (!response.ok) {
      throw new Error(`Unable to load ${type} template`);
    }

    return response.text();
  })();

  templateCache.set(type, promise);

  try {
    return await promise;
  } catch (error) {
    templateCache.delete(type);
    throw error;
  }
}

/*********************
 * data fetching
 *********************/

async function fetchData(entity, signal) {
  const response = await fetch(
    `/api/entities/${entity.type}?id=${encodeURIComponent(entity.id)}`,
    { signal, headers: { Accept: 'application/json' } }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Unable to load ${entity.type}`);
  }

  return data;
}

/*********************
 * seo metadata
 *********************/

function setMeta(entity) {
  const description = entity.type === 'league'
    ? `${entity.name} football league standings, recent fixtures and top scorers on Scoutwave.`
    : entity.type === 'club'
      ? `${entity.name} football club squad, venue and recent fixtures on Scoutwave.`
      : `${entity.name} player profile and season statistics on Scoutwave.`;

  document.title = `${entity.name} | Scoutwave`;

  const set = (selector, content) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  };

  set('meta[name="description"]', description);
  set('meta[property="og:title"]', `${entity.name} | Scoutwave`);
  set('meta[property="og:description"]', description);
  set('meta[property="og:url"]', `${location.origin}/${encodeURIComponent(entity.slug || toSlug(entity.name))}`);

  const image = entity.logo || entity.photo;
  if (image) set('meta[property="og:image"]', image);

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = `${location.origin}/${encodeURIComponent(entity.slug || toSlug(entity.name))}`;
}

/*********************
 * header (shared across all entity types)
 *********************/

function populateHeader(root, entity) {
  const logo = root.querySelector('[data-entity-logo]');
  const image = entity.logo || entity.photo || '';

  if (logo) {
    if (image) {
      logo.src = image;
      logo.alt = entity.name || '';
      logo.hidden = false;
    } else {
      logo.hidden = true;
    }
  }

  const typeEl = root.querySelector('[data-entity-type]');
  if (typeEl) typeEl.textContent = entity.type;

  const nameEl = root.querySelector('[data-entity-name]');
  if (nameEl) nameEl.textContent = entity.name || '—';

  const place = entity.country || entity.nationality || '';
  const placeEl = root.querySelector('[data-entity-place]');
  if (placeEl) {
    placeEl.textContent = place;
    placeEl.hidden = !place;
  }

  root.querySelector('[data-entity-back]')?.addEventListener('click', () => history.back());
}

/*********************
 * per-type body population
 *********************/

function fixtureRow(m) {
  const date = m.fixture?.date ? new Date(m.fixture.date).toLocaleDateString() : '—';

  return `
    <article class="entity-fixture">
      <time>${esc(date)}</time>
      <div>
        ${entityLink(m.teams?.home?.id, m.teams?.home?.name, toSlug(m.teams?.home?.name))}
        <strong>${esc(m.goals?.home ?? '—')} – ${esc(m.goals?.away ?? '—')}</strong>
        ${entityLink(m.teams?.away?.id, m.teams?.away?.name, toSlug(m.teams?.away?.name))}
      </div>
    </article>
  `;
}

function toggle(el, show) {
  if (el) el.hidden = !show;
}

function populateLeague(root, data) {
  const standings = data.standings || [];
  const fixtures = data.fixtures || [];
  const scorers = data.scorers || [];

  const standingsBody = root.querySelector('[data-league-standings]');
  if (standingsBody) {
    standingsBody.innerHTML = standings.map((x, i) => {
      const team = x.team || {};
      const all = x.all || {};

      return `
        <div class="entity-table-row">
          <span>${esc(x.rank ?? i + 1)}</span>
          <span>${entityLink(team.id, team.name, team.slug || toSlug(team.name))}</span>
          <span>${esc(all.played ?? 0)}</span>
          <span>${esc(all.win ?? 0)}</span>
          <span>${esc(all.draw ?? 0)}</span>
          <span>${esc(all.lose ?? 0)}</span>
          <span><strong>${esc(x.points ?? 0)}</strong></span>
        </div>
      `;
    }).join('');
  }
  toggle(root.querySelector('[data-league-standings-empty]'), standings.length === 0);

  const fixturesWrap = root.querySelector('[data-league-fixtures]');
  if (fixturesWrap) fixturesWrap.innerHTML = fixtures.map(fixtureRow).join('');
  toggle(root.querySelector('[data-league-fixtures-empty]'), fixtures.length === 0);

  const scorersWrap = root.querySelector('[data-league-scorers]');
  if (scorersWrap) {
    scorersWrap.innerHTML = scorers.slice(0, 10).map(x => {
      const player = x.player || {};
      const stats = x.statistics?.[0] || {};

      return `
        <div class="entity-list-row">
          ${entityLink(player.id, player.name, toSlug(player.name))}
          <span>${esc(stats.goals?.total ?? 0)} goals</span>
        </div>
      `;
    }).join('');
  }
  toggle(root.querySelector('[data-league-scorers-empty]'), scorers.length === 0);
}

function populateClub(root, data) {
  const team = data.team || {};
  const venue = data.venue || {};
  const squad = data.squad || [];
  const fixtures = data.fixtures || [];

  const set = (selector, value) => {
    const el = root.querySelector(selector);
    if (el) el.textContent = value || '—';
  };

  set('[data-club-country]', team.country);
  set('[data-club-founded]', team.founded);
  set('[data-club-venue]', venue.name);
  set('[data-club-capacity]', venue.capacity);

  const squadWrap = root.querySelector('[data-club-squad]');
  if (squadWrap) {
    squadWrap.innerHTML = squad.map(p => `
      <a class="entity-card" href="/${encodeURIComponent(toSlug(p.name))}">
        ${p.photo ? `<img class="entity-logo" src="${esc(p.photo)}" alt="" loading="lazy">` : ''}
        <strong>${esc(p.name || 'Player')}</strong>
        <span>${esc(p.position || 'Player')}</span>
      </a>
    `).join('');
  }
  toggle(root.querySelector('[data-club-squad-empty]'), squad.length === 0);

  const fixturesWrap = root.querySelector('[data-club-fixtures]');
  if (fixturesWrap) fixturesWrap.innerHTML = fixtures.map(fixtureRow).join('');
  toggle(root.querySelector('[data-club-fixtures-empty]'), fixtures.length === 0);
}

function populatePlayer(root, data) {
  const player = data.player || {};
  const stats = data.statistics?.[0] || {};

  const set = (selector, value) => {
    const el = root.querySelector(selector);
    if (el) el.textContent = (value ?? '') === '' ? '—' : value;
  };

  set('[data-player-nationality]', player.nationality);
  set('[data-player-age]', player.age);
  set('[data-player-position]', stats.games?.position);
  set('[data-player-team]', stats.team?.name);

  set('[data-player-appearances]', stats.games?.appearences ?? 0);
  set('[data-player-goals]', stats.goals?.total ?? 0);
  set('[data-player-assists]', stats.goals?.assists ?? 0);
  set('[data-player-rating]', stats.games?.rating);
}

function populateBody(root, type, data) {
  if (type === 'league') return populateLeague(root, data);
  if (type === 'club') return populateClub(root, data);
  if (type === 'player') return populatePlayer(root, data);
}

/*********************
 * status ui
 *********************/

function setStatus(root, message) {
  const status = root.querySelector('[data-entity-status]');
  const body = root.querySelector('[data-entity-body]');

  if (status) {
    status.textContent = message || '';
    status.hidden = !message;
  }

  if (body) body.hidden = Boolean(message);
}

/*********************
 * mount
 *********************/

export async function mountEntity(root, { slug } = {}) {
  if (!root || !slug) return () => {};

  activeCleanup?.();

  const controller = new AbortController();
  let disposed = false;

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    root.replaceChildren();
    root.removeAttribute('aria-busy');
  };

  activeCleanup = cleanup;
  root.setAttribute('aria-busy', 'true');
  root.innerHTML = '<div class="entity-loading" role="status" aria-live="polite">Loading…</div>';

  try {
    const entity = await resolveEntity({ slug });
    if (disposed) return cleanup;

    const templateHtml = await fetchTemplate(entity.type);
    if (disposed) return cleanup;

    root.innerHTML = templateHtml;
    populateHeader(root, entity);
    setMeta(entity);
    setStatus(root, 'Loading…');

    const data = await fetchData(entity, controller.signal);
    if (disposed) return cleanup;

    setStatus(root, '');
    populateBody(root, entity.type, data);
  } catch (error) {
    if (error.name !== 'AbortError' && !disposed) {
      root.innerHTML = `
        <section class="entity-content">
          <p class="entity-state">${esc(error.message || 'Unable to load entity.')}</p>
          <button type="button" data-entity-retry>Try again</button>
        </section>
      `;

      root.querySelector('[data-entity-retry]')?.addEventListener(
        'click',
        () => mountEntity(root, { slug }),
        { once: true }
      );
    }
  } finally {
    if (!disposed) root.removeAttribute('aria-busy');
  }

  return cleanup;
}
