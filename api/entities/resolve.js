const API='https://v3.football.api-sports.io';
const normalize=v=>String(v||'').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const aliases={'la-liga':'laliga','la-liga-santander':'laliga'};
const getKey=()=>{const k=process.env.SCOUTWAVE_FOOTBALL_API_KEY;if(!k)throw Object.assign(new Error('Football API is not configured'),{status:500});return k};
async function api(path,params={}){const u=new URL(API+path);Object.entries(params).forEach(([k,v])=>v!=null&&v!==''&&u.searchParams.set(k,v));const r=await fetch(u,{headers:{'x-apisports-key':getKey()}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.message||'Football API request failed'),{status:r.status});return d.response||[]}
const slugName=v=>normalize(v).replace(/-/g,'');
function exact(items,field,slug){return items.find(x=>normalize(field(x))===slug||slugName(field(x))===slugName(slug))}
async function resolve(type,slug){
 if(type==='league'){const x=exact(await api('/leagues',{search:slug.replace(/-/g,' ')}),v=>v.league?.name,slug);if(!x)return null;return {type:'league',id:x.league.id,slug,name:x.league.name,logo:x.league.logo,country:x.country?.name||null}}
 if(type==='club'){const x=exact(await api('/teams',{search:slug.replace(/-/g,' ')}),v=>v.team?.name,slug);if(!x)return null;return {type:'club',id:x.team.id,slug,name:x.team.name,logo:x.team.logo,country:x.team.country||null}}
 const x=exact(await api('/players',{search:slug.replace(/-/g,' '),page:1}),v=>v.player?.name,slug);if(!x)return null;return {type:'player',id:x.player.id,slug,name:x.player.name,photo:x.player.photo,nationality:x.player.nationality||null}
}
export default async function handler(req,res){if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});const requested=normalize(req.query?.slug),requestedType=normalize(req.query?.type);const slug=aliases[requested]||requested;if(!slug)return res.status(400).json({error:'Entity slug is required'});if(requestedType&&!['league','club','player'].includes(requestedType))return res.status(400).json({error:'Unsupported entity type'});try{if(requestedType){const entity=await resolve(requestedType,slug);return entity?res.status(200).json(entity):res.status(404).json({error:`${requestedType} not found`})}
 const results=await Promise.all(['league','club','player'].map(type=>resolve(type,slug).catch(()=>null)));const entity=results.find(Boolean);return entity?res.status(200).json(entity):res.status(404).json({error:'Entity not found'});
}catch(e){return res.status(e.status||500).json({error:e.message||'Entity resolution failed'})}}