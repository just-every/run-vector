import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { fetchJson, useApiResource } from '../../app/api-client';
import { OneTimeSecret } from '../integrations/ui/one-time-secret';
import '../integrations/ui/integrations.css';

const inventory=z.object({actors:z.array(z.object({id:z.string(),name:z.string(),installerName:z.string().nullable(),teamId:z.string(),scopes:z.array(z.string()),state:z.enum(['active','paused','revoked']),requiresReentry:z.number()}))});
export function AppActorsPanel({teams}:{teams:{id:string;name:string;archivedAt:string|null;canRead:boolean}[]}) {
 const data=useApiResource('/api/settings/app-actors',inventory);
 const [name,setName]=useState(''),[teamId,setTeamId]=useState(''),[write,setWrite]=useState(false),[secret,setSecret]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const act=async(run:()=>Promise<void>)=>{setBusy(true);setError('');try{await run();data.reload();}catch(cause){setError(cause instanceof Error?cause.message:'The agent change could not be saved.');}finally{setBusy(false);}};
 const install=(event:FormEvent)=>{event.preventDefault();void act(async()=>{
  setSecret(null);
  const result=await fetchJson('/api/settings/app-actors',z.object({id:z.string(),token:z.string()}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,teamId,scopes:write?['issues:read','issues:title:write']:['issues:read']})});
  setSecret(result.token);setName('');setWrite(false);
 });};
 const stop=(id:string,state:'paused'|'revoked')=>void act(async()=>{await fetchJson('/api/settings/app-actors/'+id,z.object({id:z.string(),state:z.string()}),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({state})});});
 return <section className="integrations-panel" aria-labelledby="app-actors-heading">
  <h2 id="app-actors-heading">Installed agents</h2>
  <p>Each agent has its own identity and credential. Access is limited to the selected team and the installer’s current permissions. Pause or revoke takes effect immediately.</p>
  {data.loading&&<p role="status">Loading installed agents…</p>}{data.error&&<p role="alert">{data.error.message}</p>}{error&&<p role="alert">{error}</p>}
  {secret&&<OneTimeSecret value={{token:secret}} onClose={()=>setSecret(null)}/>}
  <form onSubmit={install}><fieldset disabled={busy}><legend>Install a native agent</legend>
   <label>Agent name<input required maxLength={100} value={name} onChange={event=>setName(event.target.value)}/></label>
   <label htmlFor="app-actor-team">Agent team</label><select id="app-actor-team" required value={teamId} onChange={event=>setTeamId(event.target.value)}><option value="">Choose a team</option>{teams.filter(team=>!team.archivedAt&&team.canRead).map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select>
   <p>Permission: read issues in this team.</p>
   <label><input type="checkbox" checked={write} onChange={event=>setWrite(event.target.checked)}/>Allow issue title changes</label>
   <button type="submit">Install agent</button>
  </fieldset></form>
  {data.data&&<ul>{data.data.actors.map(actor=><li key={actor.id}>
   <strong>{actor.name}</strong><p>Installed by {actor.installerName??'Erased person'} · {teams.find(team=>team.id===actor.teamId)?.name??'Unavailable team'} · {actor.scopes.includes('issues:title:write')?'Read issues and change titles':'Read issues'}</p>
   <p role="status">{actor.state}{actor.requiresReentry?' · Credential unavailable; install a new identity to grant future access.':''}</p>
   {actor.state==='active'&&<button type="button" disabled={busy} onClick={()=>stop(actor.id,'paused')}>Pause {actor.name}</button>}
   {actor.state!=='revoked'&&<button type="button" disabled={busy} onClick={()=>stop(actor.id,'revoked')}>Revoke {actor.name}</button>}
  </li>)}</ul>}
 </section>;
}
