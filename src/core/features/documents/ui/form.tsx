import {useEffect,useId,useRef,useState} from 'react';
import {ApiError,fetchJson,useApiResource} from '../../../app/api-client';
import {administrationSchema} from '../../administration/schema';
import {MentionTextarea} from '../../notifications/ui/mention-textarea';
import {SafeMarkdown} from '../../markdown/ui/markdown';
import {documentDetail,type ParentKind} from '../schema';
import type {z} from 'zod';
export type Document=z.infer<typeof documentDetail>;
export function documentError(cause:unknown,action:string){
 if(cause instanceof ApiError){if(cause.status===409)return 'Someone published a newer version. Your text is kept.';if([403,404].includes(cause.status))return "This document doesn't exist or isn't shared with you.";if(cause.status===400)return 'Check the title and text, then try again.';}
 return "Couldn't "+action+'. Check the connection and try again.';
}
export function DocumentUnavailable(){return <><h1>This page is out of reach</h1><p>This document doesn't exist or isn't shared with you.</p><a className="document-link" href="/app/current">Back to Current</a></>;}
type Draft={title:string;body:string;expectedVersion?:number};
export function DocumentForm({parentKind,parentId,existing,onSaved}:{parentKind:ParentKind;parentId:string;existing?:Document;onSaved:(document:Document)=>void}){
 const id=useId(),form=useRef<HTMLFormElement>(null),options=useApiResource('/api/metadata',administrationSchema,undefined,{abortPendingOnDispose:false});
 const [draft,setDraft]=useState<Draft>({title:existing?.title??'',body:existing?.body??'',expectedVersion:existing?.version}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[storageError,setStorageError]=useState(''),[kept,setKept]=useState(false),[conflict,setConflict]=useState(false),[newer,setNewer]=useState<Document|null>(null);
 const storageKey=options.data?'vector:document-draft:'+options.data.workspace.id+':'+options.data.viewer.id+':'+(existing?.id??parentKind+':'+parentId):null;
 useEffect(()=>{if(!storageKey)return;try{const text=localStorage.getItem(storageKey);if(text){const value:unknown=JSON.parse(text);if(!value||typeof value!=='object'||!('title'in value)||typeof value.title!=='string'||!('body'in value)||typeof value.body!=='string'||('expectedVersion'in value&&(!Number.isInteger(value.expectedVersion)||Number(value.expectedVersion)<1)))throw Error('Invalid draft');setDraft(value as Draft);setKept(true);let ancestor:HTMLElement|null=form.current;while(ancestor){if(ancestor instanceof HTMLDetailsElement)ancestor.open=true;ancestor=ancestor.parentElement;}}}catch{setStorageError("This browser couldn't restore the draft. Keep this page open while editing.");}setReady(true);},[storageKey]);
 function persist(value:Draft){if(!storageKey)return;try{localStorage.setItem(storageKey,JSON.stringify(value));setKept(true);setStorageError('');}catch{setStorageError("This browser couldn't keep the draft. Keep this page open and try again.");}}
 function change(value:Partial<Draft>){const next={...draft,...value};setDraft(next);persist(next);}
 async function save(expectedVersion=draft.expectedVersion){setBusy(true);setError('');try{
  const document=await fetchJson('/api/documents'+(existing?'/'+existing.id:''),documentDetail,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(existing?{expectedVersion,title:draft.title,body:draft.body}:{parentKind,parentId,title:draft.title,body:draft.body})});
  if(storageKey)localStorage.removeItem(storageKey);setKept(false);setConflict(false);setNewer(null);setDraft({title:document.title,body:document.body,expectedVersion:document.version});onSaved(document);
 }catch(cause){persist(draft);setConflict(cause instanceof ApiError&&cause.status===409);setError(documentError(cause,existing?'publish the revision':'create the document'));}finally{setBusy(false);}}
 async function review(){if(!existing)return;setBusy(true);try{setNewer(await fetchJson('/api/documents/'+existing.id,documentDetail));}catch(cause){setError(documentError(cause,'load the newer version'));}finally{setBusy(false);}}
 return <form ref={form} className="document-form" aria-label={existing?'Edit document':'Document draft'} onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||!ready}><label>Document title<input required maxLength={500} value={draft.title} onChange={e=>change({title:e.target.value})}/></label><label htmlFor={id}>Document body</label><MentionTextarea id={id} aria-label="Document body" value={draft.body} onValueChange={body=>change({body})} maxLength={100000} rows={10}/>{!conflict&&!error&&<button type="submit">{existing?'Publish revision':'Create document'}</button>}</fieldset>{kept&&<p role="status">Draft kept in this browser.</p>}{storageError&&<p role="alert">{storageError}</p>}{options.error&&<p role="alert">Couldn't prepare the draft. Check the connection. <button type="button" onClick={options.reload}>Retry</button></p>}{error&&<p role="alert">{error} {conflict?<button type="button" disabled={busy} onClick={()=>void review()}>Review newer version</button>:<button type="submit" disabled={busy}>Retry</button>}</p>}{newer&&<section aria-label="Newer published version"><h2>{newer.title}</h2><SafeMarkdown>{newer.body}</SafeMarkdown><button type="button" disabled={busy} onClick={()=>void save(newer.version)}>Publish kept text on this version</button></section>}</form>;
}
