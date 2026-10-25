import {useEffect,useId,useState} from 'react';
import {z} from 'zod';
import {fetchJson,useApiResource} from '../../../app/api-client';
import {documentList,specification} from '../schema';
import './documents.css';
const receipt=z.object({specification});
export function IssueSpecification({identifier,writable}:{identifier:string;writable:boolean}){
 const id=useId();
 const path='/api/issues/'+identifier+'/specification',data=useApiResource(path,receipt,undefined,{abortPendingOnDispose:false}),documents=useApiResource('/api/documents',documentList,undefined,{abortPendingOnDispose:false});
 const [selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(data.data)setSelected(data.data.specification?.id??'');},[data.data]);
 async function save(){setBusy(true);setError('');try{const value=await fetchJson(path,receipt,{method:selected?'PUT':'DELETE',...(selected?{headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId:selected})}:{})});data.publishReceipt(()=>value);data.refreshAfterMutation();}catch(cause){setError(cause instanceof Error?cause.message:'The specification could not be changed.');}finally{setBusy(false);}}
 const current=data.data?.specification;
 return <section className="document-section" aria-label="Issue specification"><h2>Specification</h2>{current?<p><a href={'/app/documents/'+current.id}>{current.title}</a></p>:data.data?<p>No specification linked.</p>:<p role="status">Loading specification…</p>}{writable&&<details><summary>Set specification</summary><form className="document-form" onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||!documents.data}><label htmlFor={id}>Specification document</label><select id={id} aria-label="Specification document" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">No specification</option>{current&&!documents.data?.documents.some(d=>d.id===current.id)&&<option value={current.id}>{current.title}</option>}{documents.data?.documents.map(doc=><option key={doc.id} value={doc.id}>{doc.title}</option>)}</select><button type="submit">Save specification</button></fieldset></form></details>}{(error||data.error||documents.error)&&<p role="alert">{error||data.error?.message||documents.error?.message}</p>}</section>;
}
