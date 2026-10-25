import {useEffect,useId,useState} from 'react';
import {z} from 'zod';
import {fetchJson,useApiResource} from '../../../app/api-client';
import {administrationSchema} from '../../administration/schema';
import {issueDetailSchema} from '../../issues/ui/data';
import {documentList,specification} from '../schema';
import {documentError} from './form';
import './documents.css';
const receipt=z.object({specification});
// Keep the specification in the existing issue read, including streamed receipts.
export const documentIssueDetailSchema=issueDetailSchema.extend({specification:specification.optional()});
export function IssueSpecification({identifier,writable,current}:{identifier:string;writable:boolean;current:z.infer<typeof specification>}){
 const [open,setOpen]=useState(false),[committed,setCommitted]=useState(current);
 return <section className="document-section document-inspector" aria-label="Issue specification"><details className="secondary-section" onToggle={e=>{if(e.currentTarget.open)setOpen(true);}}><summary>Specification · {committed?.title??'None'}</summary>{committed&&<a className="document-link" href={'/app/documents/'+committed.id}>{committed.title}</a>}{open&&writable&&<SpecificationPicker key={identifier} identifier={identifier} current={committed} onSaved={setCommitted}/>}</details></section>;
}
function SpecificationPicker({identifier,current,onSaved}:{identifier:string;current:z.infer<typeof specification>;onSaved:(value:z.infer<typeof specification>)=>void}){
 const id=useId(),documents=useApiResource('/api/documents',documentList,undefined,{abortPendingOnDispose:false}),options=useApiResource('/api/metadata',administrationSchema,undefined,{abortPendingOnDispose:false});
 const [selected,setSelected]=useState(current?.id??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[ready,setReady]=useState(false);
 const storageKey=options.data?'vector:specification-draft:'+options.data.workspace.id+':'+options.data.viewer.id+':'+identifier:null;
 useEffect(()=>{if(!storageKey)return;try{const raw=localStorage.getItem(storageKey);if(raw){const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||!('documentId'in value)||typeof value.documentId!=='string')throw Error('Invalid choice');if(value.documentId!==(current?.id??'')){setSelected(value.documentId);setError("This change hasn't been confirmed. Your choice is kept.");}else localStorage.removeItem(storageKey);}}catch{setError("Couldn't restore the choice from this browser. Choose a document again.");}setReady(true);},[storageKey]);
 async function save(value:string){setBusy(true);setError('');setSaved(false);if(storageKey)try{localStorage.setItem(storageKey,JSON.stringify({documentId:value}));}catch{setError("This browser couldn't keep the choice. Keep this page open until it is confirmed.");}try{const result=await fetchJson('/api/issues/'+identifier+'/specification',receipt,{method:value?'PUT':'DELETE',...(value?{headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId:value})}:{})});onSaved(result.specification);setSaved(true);setError('');if(storageKey)try{localStorage.removeItem(storageKey);}catch{setError("The change was confirmed, but this browser couldn't clear its draft.");}}catch(cause){setError(documentError(cause,'change the specification'));}finally{setBusy(false);}}
 return <form className="document-form" onSubmit={e=>{e.preventDefault();void save(selected);}}><fieldset disabled={busy||!documents.data||!ready}><label htmlFor={id}>Specification document</label><select id={id} value={selected} onChange={e=>{const value=e.target.value;setSelected(value);void save(value);}}><option value="">No specification</option>{current&&!documents.data?.documents.some(d=>d.id===current.id)&&<option value={current.id}>{current.title}</option>}{documents.data?.documents.map(doc=><option key={doc.id} value={doc.id}>{doc.title}</option>)}</select></fieldset>{busy&&<p role="status">Updating…</p>}{saved&&<p role="status">Saved</p>}{error&&<p role="alert">{error} <button type="submit" disabled={busy}>Retry</button></p>}{(documents.error||options.error)&&<p role="alert">Couldn't load documents. Check the connection. <button type="button" onClick={()=>{documents.reload();options.reload();}}>Retry</button></p>}</form>;
}
