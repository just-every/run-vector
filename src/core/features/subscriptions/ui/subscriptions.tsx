import {useEffect,useState} from 'react';
import {z} from 'zod';
import {fetchJson,useApiResource} from '../../../app/api-client';
import {subscriptionList,type SubjectType} from '../schema';
import './subscriptions.css';
const changed=()=>window.dispatchEvent(new Event('vector:subject-subscriptions-changed'));
function useSubscriptions(){
 const resource=useApiResource('/api/subscriptions',subscriptionList);
 useEffect(()=>{window.addEventListener('vector:subject-subscriptions-changed',resource.reload);return()=>window.removeEventListener('vector:subject-subscriptions-changed',resource.reload);},[resource.reload]);
 return resource;
}
export function SubjectSubscribe({subjectType,subjectId}:{subjectType:SubjectType;subjectId:string}){
 const data=useSubscriptions(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const current=data.data?.subscriptions.find(s=>s.subjectType===subjectType&&s.subjectId===subjectId);
 async function toggle(){setBusy(true);setError('');try{if(current)await fetchJson('/api/subscriptions/'+current.id,z.object({removed:z.boolean()}),{method:'DELETE'});else await fetchJson('/api/subscriptions',z.object({id:z.string()}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subjectType,subjectId})});changed();}catch(e){setError(e instanceof Error?e.message:'The subscription could not be changed.');}finally{setBusy(false);}}
 return <span className="subject-subscribe"><button type="button" disabled={busy||!data.data} title={current?'Stop subject updates':'Receive subject updates'} onClick={()=>void toggle()}>{current?'Unsubscribe from ':'Subscribe to '}{subjectType==='view'?'saved view':subjectType}</button>{(error||data.error)&&<span role="alert">{error||data.error?.message}</span>}</span>;
}
export function SubscriptionFilters({team,label}:{team:string;label:string}){
 const valid=(id:string)=>/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id);
 if(!valid(team)&&!valid(label))return null;
 return <div className="subject-context-subscriptions">{valid(team)&&<SubjectSubscribe subjectType="team" subjectId={team}/>} {valid(label)&&<SubjectSubscribe subjectType="label" subjectId={label}/>}</div>;
}
export function SubscriptionManager(){
 const data=useSubscriptions(),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function add(){const [subjectType,subjectId]=selected.split(':');setBusy(true);setError('');try{await fetchJson('/api/subscriptions',z.object({id:z.string()}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subjectType,subjectId})});changed();}catch(e){setError(e instanceof Error?e.message:'The subscription could not be saved.');}finally{setBusy(false);}}
 async function remove(id:string){setBusy(true);setError('');try{await fetchJson('/api/subscriptions/'+id,z.object({removed:z.boolean()}),{method:'DELETE'});changed();}catch(e){setError(e instanceof Error?e.message:'The subscription could not be removed.');}finally{setBusy(false);}}
 return <section className="subject-subscriptions" aria-label="Subject subscriptions"><h2>Subject subscriptions</h2><p>Receive new matching issues and status changes. Your existing status and completion channel settings apply. Several matching subscriptions produce one notice.</p><form onSubmit={e=>{e.preventDefault();void add();}}><label>Subscription subject<select value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy||!data.data}><option value="">Choose a subject</option>{(['team','project','label','view'] as const).map(type=><optgroup key={type} label={type==='view'?'Saved views':type[0].toUpperCase()+type.slice(1)+'s'}>{data.data?.subjects.filter(s=>s.subjectType===type).map(s=><option key={s.subjectId} value={type+':'+s.subjectId}>{s.name}</option>)}</optgroup>)}</select></label><button type="submit" title="Receive subject updates" disabled={busy||!selected}>Subscribe</button></form>{(error||data.error)&&<p role="alert">{error||data.error?.message}</p>}<ul>{data.data?.subscriptions.map(s=><li key={s.id}>{s.available?<a href={s.url}>{s.name}</a>:<span>Unavailable subject</span>}<span> · {s.subjectType}</span><button type="button" title="Stop subject updates" disabled={busy} onClick={()=>void remove(s.id)}>Unsubscribe {s.name}</button></li>)}</ul>{data.data?.subscriptions.length===0&&<p>You have no subject subscriptions.</p>}</section>;
}
