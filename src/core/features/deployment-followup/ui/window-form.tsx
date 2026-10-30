import {useState} from 'react';
import {z} from 'zod';
import {ApiError,fetchJson} from '../../../app/api-client';
import {followupWindowSchema,type FollowupWindow} from '../schema';

/** Settings → Teams → Git automation: the team's explicit production follow-up window (PUSH-003). */
export function FollowupWindowForm({teamId,teamName,followup,onSaved}:{teamId:string;teamName:string;followup:FollowupWindow;onSaved:()=>void}){
 const [version,setVersion]=useState(followup.version),[hours,setHours]=useState(followup.windowHours?String(followup.windowHours):''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function save(){
  setBusy(true);setMessage('');
  try{
   const receipt=await fetchJson('/api/settings/teams/'+teamId,z.object({saved:z.boolean(),followup:followupWindowSchema}),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({deploymentFollowup:{windowHours:hours?Number(hours):null,expectedVersion:version}})});
   setVersion(receipt.followup.version);setMessage(receipt.followup.windowHours?'Follow-up saved.':'Follow-up turned off.');onSaved();
  }catch(e){setMessage(e instanceof ApiError&&e.status===409?'This follow-up changed. Reload the page before saving again.':e instanceof ApiError&&e.status===403?'You no longer have permission to change this team’s settings.':'Follow-up could not be saved. Try again.');}
  finally{setBusy(false);}
 }
 return <form onSubmit={event=>{event.preventDefault();void save();}}><fieldset disabled={busy}><legend>Production follow-up</legend>
  <p>When a merged pull request has not reached this team’s production environment within the window, Vector asks the issue’s assignee why, once, in their Inbox. Leave it blank to turn follow-up off; only merges received after it is turned on are followed.</p>
  <label htmlFor={teamId+'-followup'}>{teamName} production follow-up window in hours</label>
  <input id={teamId+'-followup'} type="number" min={1} max={720} placeholder="Off" value={hours} onChange={e=>setHours(e.target.value)}/>
  <button type="submit">Save production follow-up</button>{message&&<p role="status">{message}</p>}
 </fieldset></form>;
}
