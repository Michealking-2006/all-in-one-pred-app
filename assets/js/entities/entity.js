import { resolveEntity } from './resolver.js';

const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let activeCleanup=null;

async function fetchData(entity,signal){const r=await fetch(`/api/entities/${entity.type}?id=${encodeURIComponent(entity.id)}`,{signal,headers:{Accept:'application/json'}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Unable to load ${entity.type}`);return d}

function body(type,data){
 if(type==='league')return `<section class="entity-section"><h2>${esc(data.league?.name||'League')}</h2><p>${esc(data.league?.country?.name||'')}</p><div class="entity-state">League data loaded.</div></section>`;
 if(type==='club')return `<section class="entity-section"><h2>${esc(data.team?.name||'Club')}</h2><p>${esc(data.team?.country||'')}</p><div class="entity-state">Club data loaded.</div>`;
 return `<section class="entity-section"><h2>${esc(data.player?.name||'Player')}</h2><p>${esc(data.player?.nationality||'')}</p><div class="entity-state">Player data loaded.</div>`;
}

async function mount(root,slug){activeCleanup?.();const controller=new AbortController();let disposed=false;activeCleanup=()=>{disposed=true;controller.abort();root.replaceChildren()};root.setAttribute('aria-busy','true');root.innerHTML='<div class="entity-loading">Loading…</div>';try{const entity=await resolveEntity({slug});if(disposed)return activeCleanup;const data=await fetchData(entity,controller.signal);if(disposed)return activeCleanup;const name=entity.name||entity.slug,image=entity.logo||entity.photo||'',location=entity.country||entity.nationality||'';root.innerHTML=`<article class="entity-page entity-page--${esc(entity.type)}"><header class="entity-header"><button type="button" class="entity-back" data-entity-back aria-label="Go back">‹</button><div class="entity-logo-wrap">${image?`<img class="entity-logo" src="${esc(image)}" alt="" loading="eager">`:''}</div><div class="entity-heading"><p class="entity-type">${esc(entity.type)}</p><h1>${esc(name)}</h1>${location?`<p>${esc(location)}</p>`:''}</div></header><main class="entity-content">${body(entity.type,data)}</main></article>`;root.querySelector('[data-entity-back]')?.addEventListener('click',()=>history.back())}catch(error){if(error.name!=='AbortError'&&!disposed){root.innerHTML=`<section class="entity-content"><p class="entity-state">${esc(error.message||'Unable to load entity.')}</p><button type="button" data-entity-retry>Try again</button></section>`;root.querySelector('[data-entity-retry]')?.addEventListener('click',()=>mount(root,slug))}}finally{if(!disposed)root.removeAttribute('aria-busy')}return activeCleanup}

export async function mountEntity(root,{slug}={}){if(!root||!slug)return()=>{};return mount(root,slug)}
