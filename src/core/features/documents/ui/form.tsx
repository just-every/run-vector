import {useEffect,useId,useRef,useState} from 'react';
import {ApiError,fetchJson} from '../../../app/api-client';
import {MentionTextarea} from '../../notifications/ui/mention-textarea';
import {SafeMarkdown} from '../../markdown/ui/markdown';
import {documentDetail,type ParentKind} from '../schema';
import type {z} from 'zod';
export type Document=z.infer<typeof documentDetail>;
export type DocumentDraftScope={workspaceId:string;operatorId:string};
const newerVersion='Someone published a newer version. Your text is kept.';
export function documentError(cause:unknown,action:string){
 if(cause instanceof ApiError){if(cause.status===409)return newerVersion;if([403,404].includes(cause.status))return "This document doesn't exist or isn't shared with you.";if(cause.status===400)return 'Check the title and text, then try again.';}
 return "Couldn't "+action+'. Check the connection and try again.';
}
export function DocumentUnavailable(){return <><h1>This page is out of reach</h1><p>This document doesn't exist or isn't shared with you.</p><a className="document-link" href="/app/current">Back to Current</a></>;}
type Draft={title:string;body:string;expectedVersion?:number};
type Base={title:string;body:string};
const same=(a:Base,b:Base)=>a.title===b.title&&a.body===b.body;
const isBase=(value:unknown):value is Base=>!!value&&typeof value==='object'&&'title'in value&&typeof value.title==='string'&&'body'in value&&typeof value.body==='string';
function readDraft(text:string):Draft&{base?:Base}{
 const value:unknown=JSON.parse(text);
 if(!isBase(value))throw Error('Invalid draft');
 const {expectedVersion,base}=value as {expectedVersion?:unknown;base?:unknown};
 if(expectedVersion!==undefined&&(typeof expectedVersion!=='number'||!Number.isInteger(expectedVersion)||expectedVersion<1))throw Error('Invalid draft');
 if(base!==undefined&&!isBase(base))throw Error('Invalid draft');
 return {title:value.title,body:value.body,expectedVersion,base};
}
type Next='retry'|'review'|'leave'|null;
/** A draft is kept only while it differs from where the form started: empty for a new document, the published version for an edit. */
export function DocumentForm({parentKind,parentId,existing,onSaved,scope}:{scope:DocumentDraftScope;parentKind:ParentKind;parentId:string;existing?:Document;onSaved:(document:Document)=>void}){
 const id=useId(),form=useRef<HTMLFormElement>(null),titleField=useRef<HTMLInputElement>(null);
 const published:Draft={title:existing?.title??'',body:existing?.body??'',expectedVersion:existing?.version};
 const [draft,setDraft]=useState<Draft>(published),[base,setBase]=useState<Base>(published),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[next,setNext]=useState<Next>(null),[fieldError,setFieldError]=useState(''),[storageError,setStorageError]=useState(''),[kept,setKept]=useState(false),[newer,setNewer]=useState<Document|null>(null);
 const storageKey='vector:document-draft:'+scope.workspaceId+':'+scope.operatorId+':'+(existing?.id??parentKind+':'+parentId);
 useEffect(()=>{try{const text=localStorage.getItem(storageKey);if(text){const stored=readDraft(text),stale=!!existing&&stored.expectedVersion!==undefined&&stored.expectedVersion<existing.version,start=stale?stored.base:published;
  if(start&&same(stored,start))localStorage.removeItem(storageKey);
  else{setDraft({title:stored.title,body:stored.body,expectedVersion:stored.expectedVersion});setBase(start??published);setKept(true);if(stale){setError(newerVersion);setNext('review');}let ancestor:HTMLElement|null=form.current;while(ancestor){if(ancestor instanceof HTMLDetailsElement)ancestor.open=true;ancestor=ancestor.parentElement;}}}}catch{setStorageError("This browser couldn't restore the draft. Keep this page open while editing.");}setReady(true);},[storageKey]);
 function persist(value:Draft){try{if(same(value,base)){localStorage.removeItem(storageKey);setKept(false);}else{localStorage.setItem(storageKey,JSON.stringify({...value,base}));setKept(true);}setStorageError('');}catch{setStorageError("This browser couldn't keep the draft. Keep this page open and try again.");}}
 function change(value:Partial<Draft>){const changed={...draft,...value};setDraft(changed);setFieldError('');persist(changed);}
 function discard(){try{localStorage.removeItem(storageKey);setStorageError('');}catch{setStorageError("This browser couldn't remove the draft. Keep this page open and try again.");}setDraft(published);setBase(published);setKept(false);setError('');setNext(null);setFieldError('');setNewer(null);titleField.current?.focus({preventScroll:true});}
 async function save(expectedVersion=draft.expectedVersion){setBusy(true);setError('');setNext(null);setFieldError('');try{
  const document=await fetchJson('/api/documents'+(existing?'/'+existing.id:''),documentDetail,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(existing?{expectedVersion,title:draft.title,body:draft.body}:{parentKind,parentId,title:draft.title,body:draft.body})});
  localStorage.removeItem(storageKey);setKept(false);setNewer(null);const saved={title:document.title,body:document.body,expectedVersion:document.version};setDraft(saved);setBase(saved);onSaved(document);
 }catch(cause){persist(draft);const status=cause instanceof ApiError?cause.status:0,text=documentError(cause,existing?'publish the revision':'create the document');
  if(status===400)setFieldError(text);else{setError(text);setNext(status===409?'review':[403,404].includes(status)?'leave':!status||status>=500||status===408||status===429?'retry':null);}
 }finally{setBusy(false);}}
 async function review(){if(!existing)return;setBusy(true);try{setNewer(await fetchJson('/api/documents/'+existing.id,documentDetail));}catch(cause){setError(documentError(cause,'load the newer version'));}finally{setBusy(false);}}
 return <form ref={form} className="document-form" aria-label={existing?'Edit document':'Document draft'} onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||!ready}><label>Document title<input ref={titleField} required maxLength={500} value={draft.title} aria-invalid={fieldError?true:undefined} aria-describedby={fieldError?id+'-title':undefined} onChange={e=>change({title:e.target.value})}/></label>{fieldError&&<p id={id+'-title'} role="alert">{fieldError}</p>}<label htmlFor={id}>Document body</label><MentionTextarea id={id} aria-label="Document body" value={draft.body} onValueChange={body=>change({body})} maxLength={100000} rows={10}/>{!error&&<button type="submit">{existing?'Publish revision':'Create document'}</button>}</fieldset>{kept&&<p><span role="status">Draft kept in this browser.</span> <button type="button" disabled={busy} onClick={discard}>Discard draft</button></p>}{storageError&&<p role="alert">{storageError}</p>}{error&&<p role="alert">{error} {next==='review'?<button type="button" disabled={busy} onClick={()=>void review()}>Review newer version</button>:next==='retry'?<button type="submit" disabled={busy}>Retry</button>:next==='leave'?<a className="document-link" href="/app/current">Back to Current</a>:null}</p>}{newer&&<section aria-label="Newer published version"><h2>{newer.title}</h2><SafeMarkdown>{newer.body}</SafeMarkdown><button type="button" disabled={busy} onClick={()=>void save(newer.version)}>Publish kept text on this version</button></section>}</form>;
}
