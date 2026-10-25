import {useId,useState} from 'react';
import {fetchJson} from '../../../app/api-client';
import {MentionTextarea} from '../../notifications/ui/mention-textarea';
import {documentDetail,type ParentKind} from '../schema';
import type {z} from 'zod';
export type Document=z.infer<typeof documentDetail>;
export function DocumentForm({parentKind,parentId,existing,onSaved}:{parentKind:ParentKind;parentId:string;existing?:Document;onSaved:(document:Document)=>void}){
 const id=useId(),[title,setTitle]=useState(existing?.title??''),[body,setBody]=useState(existing?.body??''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{
  const document=await fetchJson('/api/documents'+(existing?'/'+existing.id:''),documentDetail,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(existing?{expectedVersion:existing.version,title,body}:{parentKind,parentId,title,body})});onSaved(document);
 }catch(cause){setError(cause instanceof Error?cause.message:'The document could not be saved.');}finally{setBusy(false);}}
 return <form className="document-form" aria-label={existing?'Edit document':'Document draft'} onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy}><label>Document title<input required maxLength={500} value={title} onChange={e=>setTitle(e.target.value)}/></label><label htmlFor={id}>Document body</label><MentionTextarea id={id} aria-label="Document body" value={body} onValueChange={setBody} maxLength={100000} rows={10}/><button type="submit">{existing?'Save document':'Create document'}</button></fieldset>{error&&<p role="alert">{error}</p>}</form>;
}
