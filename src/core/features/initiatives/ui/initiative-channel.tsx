import {useState,type FormEvent} from 'react';
import {z} from 'zod';
import {fetchJson,useApiResource} from '../../../app/api-client';
import {channelEventLabels,notPostingMessage,initiativeBindingState,initiativeChannelEvents} from '../../integrations/channels/schema';
type InitiativeEvent=typeof initiativeChannelEvents[number];
const receipt=z.object({version:z.string().nullable()});
const service={slack:'Slack',discord:'Discord'} as const;
/** INIT-001 scoped capability: this initiative's channel, chosen only from Owner- or Admin-approved destinations. */
export function InitiativeChannel({initiativeId,onChanged}:{initiativeId:string;onChanged:()=>void}){
 const path='/api/initiatives/'+initiativeId+'/channel-binding',state=useApiResource(path,initiativeBindingState),data=state.data,binding=data?.binding;
 const [selected,setSelected]=useState(''),[picked,setPicked]=useState<InitiativeEvent[]|null>(null),[pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const approved=binding&&data?.destinations.some(d=>d.provider===binding.provider&&d.channelId===binding.channelId)?binding.provider+':'+binding.channelId:'';
 const choice=selected||approved,events=picked??(binding?initiativeChannelEvents.filter(e=>binding.events.includes(e)):['initiative.updated']);
 async function send(method:'PUT'|'DELETE',body:unknown,done:string){
  setPending(true);setError('');setNotice('');
  try{await fetchJson(path,receipt,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});setSelected('');setPicked(null);setNotice(done);state.reload();onChanged();}
  catch(cause){setError(cause instanceof Error?cause.message:'The initiative channel could not be saved.');}
  finally{setPending(false);}
 }
 function save(event:FormEvent<HTMLFormElement>){event.preventDefault();const [provider,channelId]=choice.split(':');void send('PUT',{provider,channelId,events,expectedVersion:data?.version??null},'Initiative channel saved.');}
 return <details className="initiative-section"><summary>Channel notifications</summary>
 {state.error&&<p role="alert">{state.error.message}</p>}
 {data&&<form aria-label="Initiative channel" onSubmit={save}><fieldset disabled={pending}>
  <p>{binding?binding.live?`Posting to ${service[binding.provider]} #${binding.channelName}: ${binding.events.map(e=>channelEventLabels[e]).join(', ')}.`:`Not posting: ${binding.notPosting?notPostingMessage(binding.notPosting,binding.channelName):'Save the channel again to resume posting.'}`:'No channel posts this initiative’s changes.'}</p>
  {data.destinations.length?<>
   <label>Approved channel<select aria-label="Approved channel" required value={choice} onChange={e=>setSelected(e.target.value)}><option value="">Choose an approved channel</option>{data.destinations.map(d=><option key={d.provider+d.channelId} value={d.provider+':'+d.channelId}>{service[d.provider]} #{d.channelName}</option>)}</select></label>
   <fieldset><legend>Events to post</legend>{initiativeChannelEvents.map(e=><label className="initiative-checkbox" key={e}><input type="checkbox" checked={events.includes(e)} onChange={x=>setPicked(x.target.checked?[...events,e]:events.filter(v=>v!==e))}/>{channelEventLabels[e]}</label>)}</fieldset>
  </>:<p>An Owner or Admin must approve a channel for this initiative.</p>}
  <div className="initiative-actions">{data.destinations.length>0&&<button disabled={!choice||!events.length}>Save initiative channel</button>}{binding&&<button type="button" onClick={()=>void send('DELETE',{expectedVersion:data.version},'Initiative channel withdrawn.')}>Withdraw initiative channel</button>}</div>
 </fieldset></form>}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </details>;
}
