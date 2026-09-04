const API='https://v3.football.api-sports.io';
async function call(path,params={}){const key=process.env.SCOUTWAVE_FOOTBALL_API_KEY;if(!key)throw Object.assign(new Error('Football API is not configured'),{status:500});const u=new URL(API+path);Object.entries(params).forEach(([k,v])=>v!=null&&v!==''&&u.searchParams.set(k,v));const r=await fetch(u,{headers:{'x-apisports-key':key}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.message||'Football API request failed'),{status:r.status});return Array.isArray(d.response)?d.response:[]}
const safe=async(fn,fallback)=>{try{return await fn()}catch{return fallback}};
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const id=Number(req.query?.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Valid club id is required'});
 try{
   const season=Number(req.query?.season)||new Date().getUTCFullYear();
   const team=await call('/teams',{id});
   const x=team[0]||{};
   if(!x.team?.id)return res.status(404).json({error:'Club not found'});
   const [squad,fixtures]=await Promise.all([
     safe(()=>call('/players/squads',{team:id}),[]),
     safe(()=>call('/fixtures',{team:id,season,last:5}),[]),
   ]);
   return res.status(200).json({season,team:x.team,venue:x.venue||null,squad:squad[0]?.players||[],fixtures});
 }catch(e){return res.status(e.status||500).json({error:e.message||'Club request failed'})}
}