const API_BASE='https://v3.football.api-sports.io';
const currentSeason=()=>new Date().getUTCFullYear();
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const id=String(req.query?.id||'').trim();
 const season=Number(req.query?.season)||currentSeason();
 if(!/^\d+$/.test(id)||Number(id)<1)return res.status(400).json({error:'Valid player id is required'});
 const key=process.env.SCOUTWAVE_FOOTBALL_API_KEY;
 if(!key)return res.status(500).json({error:'Football API is not configured'});
 try{
   const url=new URL(`${API_BASE}/players`);url.searchParams.set('id',id);url.searchParams.set('season',String(season));
   const r=await fetch(url,{headers:{'x-apisports-key':key,Accept:'application/json'}});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)return res.status(r.status).json({error:d.message||'Unable to load player'});
   const x=Array.isArray(d.response)?d.response[0]:null;
   if(!x?.player?.id)return res.status(404).json({error:'Player not found'});
   return res.status(200).json({season,player:x.player,statistics:Array.isArray(x.statistics)?x.statistics:[]});
 }catch(e){return res.status(e.status||500).json({error:e.message||'Unable to load player'});}
}