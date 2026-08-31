const API_BASE='https://v3.football.api-sports.io';
export default async function handler(req,res){
 if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
 const id=String(req.query?.id||''); if(!/^\d+$/.test(id)) return res.status(400).json({error:'Valid club id is required'});
 const key=process.env.SCOUTWAVE_FOOTBALL_API_KEY; if(!key) return res.status(500).json({error:'Football API is not configured'});
 try{const url=new URL(`${API_BASE}/teams`);url.searchParams.set('id',id);const r=await fetch(url,{headers:{'x-apisports-key':key}});const d=await r.json().catch(()=>({}));if(!r.ok)return res.status(r.status).json({error:d.message||'Unable to load club'});const x=d.response?.[0];if(!x)return res.status(404).json({error:'Club not found'});return res.status(200).json({team:x.team,venue:x.venue});}catch(e){return res.status(500).json({error:e.message||'Unable to load club'});}
}
