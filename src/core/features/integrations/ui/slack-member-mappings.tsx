import {useState,type FormEvent} from 'react';
import {z} from 'zod';
import {useApiResource} from '../../../app/api-client';
import {acknowledged,send} from './client';
const configuration=z.object({members:z.array(z.object({id:z.string(),name:z.string()})),mappings:z.array(z.object({operatorId:z.string(),name:z.string(),slackTeamId:z.string(),slackUserId:z.string()}))});
/** Explicit administration uses the same Settings forms as channel bindings. */
export function SlackMemberMappings(){
 const resource=useApiResource('/api/settings/integrations/slack/app/members',configuration);
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function run(path:string,body:unknown,method='POST'){
  setPending(true);setError('');setNotice('');
  try{await send('/slack/app/members'+path,acknowledged,body,method);resource.reload();return true;}
  catch(cause){setError(cause instanceof Error?cause.message:'Slack mapping could not be saved.');return false;}
  finally{setPending(false);}
 }
 async function map(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;
  if(await run('',Object.fromEntries(new FormData(form)))){form.reset();setNotice('Slack member mapped. New mentions use this member’s current permissions.');}
 }
 return <section aria-labelledby="slack-member-mapping-heading"><h4 id="slack-member-mapping-heading">Slack member mapping</h4>
 <p>Map a Slack account to an active Member or Guest, or to your own account. Mentions in a team’s bound channel create issues as that member.</p>
 {resource.error&&<p role="alert">{resource.error.message}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {resource.data&&<><form aria-label="Map Slack member" onSubmit={map}><fieldset disabled={pending}>
 <label>Vector member<select name="operatorId" required defaultValue=""><option value="">Choose a member</option>{resource.data.members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
 <div className="integration-fields"><label>Slack workspace ID<input name="slackTeamId" required pattern="[TE][A-Z0-9]{2,30}" maxLength={31}/></label><label>Slack member ID<input name="slackUserId" required pattern="[UW][A-Z0-9]{2,30}" maxLength={31}/></label></div>
 <button>Map Slack member</button></fieldset></form>
 <ul>{resource.data.mappings.map(mapping=><li key={mapping.operatorId}><strong>{mapping.name}</strong> · {mapping.slackUserId} · {mapping.slackTeamId} <button type="button" disabled={pending} onClick={()=>void run('/'+mapping.operatorId,undefined,'DELETE')}>Remove mapping for {mapping.name}</button></li>)}</ul></>}
 </section>;
}
