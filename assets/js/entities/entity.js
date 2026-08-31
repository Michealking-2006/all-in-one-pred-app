import { resolveEntity } from './resolver.js';

const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
let activeCleanup = null;

async function fetchEntityData(entity, signal) {
  const response = await fetch(`/api/entities/${entity.type}?id=${encodeURIComponent(entity.id)}`, { signal, headers:{ Accept:'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Unable to load ${entity.type}`);
  return data;
}

function render(root, entity, data) {
  const name = entity.name || data.name || entity.slug;
  const image = entity.logo || entity.photo || data.logo || data.photo || '';
  const location = entity.country || entity.nationality || data.country || data.nationality || '';
  root.innerHTML = `<article class="entity-page entity-page--${esc(entity.type)}"><header class="entity-header"><button type="button" class="entity-back" data-entity-back aria-label="Go back">‹</button><div class="entity-logo-wrap">${image ? `<img class="entity-logo" src="${esc(image)}" alt="" loading="eager">` : ''}</div><div class="entity-heading"><p class="entity-type">${esc(entity.type)}</p><h1>${esc(name)}</h1>${location ? `<p>${esc(location)}</p>` : ''}</div></header><main class="entity-content" data-entity-content>${renderBody(entity.type, data)}</main></article>`;
  root.querySelector('[data-entity-back]')?.addEventListener('click', () => history.back());
}

function renderBody(type, data) {
  if (type === 'league') return '<p class="entity-state">League data loaded.</p>';
  if (type === 'club') return '<p class="entity-state">Club data loaded.</p>';
  return '<p class="entity-state">Player data loaded.</p>';
}

export async function mountEntity(root, { slug } = {}) {
  if (!root) return () => {};
  activeCleanup?.();
  const controller = new AbortController();
  let disposed = false;
  activeCleanup = () => { disposed = true; controller.abort(); root.replaceChildren(); };
  root.setAttribute('aria-busy','true');
  root.innerHTML = '<div class="entity-loading">Loading…</div>';
  try {
    const entity = await resolveEntity({ type: 'league', slug });
    if (disposed) return activeCleanup;
    const data = await fetchEntityData(entity, controller.signal);
    if (disposed) return activeCleanup;
    render(root, { ...entity, ...data }, data);
  } catch (error) {
    if (error.name !== 'AbortError' && !disposed) root.innerHTML = `<section class="entity-content"><p class="entity-state">${esc(error.message || 'Unable to load entity.')}</p><button type="button" data-entity-retry>Try again</button></section>`;
    root.querySelector('[data-entity-retry]')?.addEventListener('click', () => mountEntity(root, { slug }));
  } finally { if (!disposed) root.removeAttribute('aria-busy'); }
  return activeCleanup;
}
