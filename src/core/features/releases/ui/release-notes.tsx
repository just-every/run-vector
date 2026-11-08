import {useEffect,useId,useRef,useState} from 'react';
import type {z} from 'zod';
import {ApiError,fetchJson,isUnavailableResourceError,useApiResource} from '../../../app/api-client';
import type {Administration} from '../../administration/schema';
import {SafeMarkdown} from '../../markdown/ui/markdown';
import {releaseNotesResult} from '../notes/schema';
import type {releaseDetail} from '../schema';
import {ReleaseNoteSources} from './release-note-sources';
import './release-notes.css';

type Detail=z.infer<typeof releaseDetail>;
type Notes=z.infer<typeof releaseNotesResult>;
// Local text is an overlay on the saved draft, based on the version it edits.
type Edit={text:string;base:number};
type Busy='generate'|'save'|null;

const unavailable=(error:unknown)=>error instanceof ApiError&&error.status===410?'These release notes were withdrawn.':'Release notes are unavailable to you.';
function memberName(metadata:Administration|null,id:string){
 const operator=metadata?.operators.find(o=>o.id===id);
 if(!operator)return metadata?'a former workspace member':'a workspace member';
 return operator.id===metadata?.viewer.id?operator.name+' (you)':operator.name;
}
const issues=(count:number)=>count+' completed issue'+(count===1?'':'s');
function DraftPreview({text}:{text:string}){
 const id=useId();
 return <section className="release-notes-preview" aria-labelledby={id}><h3 id={id}>Draft preview</h3>{text.trim()?<SafeMarkdown>{text}</SafeMarkdown>:<p>Nothing to preview yet.</p>}</section>;
}

export function ReleaseNotes({release,readOnly,metadata,onStaleRelease}:{release:Detail;readOnly:boolean;metadata:Administration|null;onStaleRelease:()=>void}){
 const url='/api/releases/'+release.id+'/notes',notes=useApiResource(url,releaseNotesResult),headingId=useId();
 const [edit,setEdit]=useState<Edit|null>(null),[busy,setBusy]=useState<Busy>(null),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
 const [notice,setNotice]=useState(''),[loss,setLoss]=useState<ApiError|null>(null),[hidden,setHidden]=useState<Notes|null>(null);
 // A mutation settling after access loss or unmount must not publish anything.
 const epoch=useRef(0),latest=useRef(notes.data);latest.current=notes.data;
 useEffect(()=>()=>{epoch.current++;},[]);
 const resourceLost=isUnavailableResourceError(notes.error);
 useEffect(()=>{if(!resourceLost)return;epoch.current++;setEdit(null);setConflict(false);setNotice('');},[resourceLost]);
 // A release edit or scope change refreshes releaseChanged; local text stays.
 const seenVersion=useRef(release.version),{refreshAfterMutation}=notes;
 useEffect(()=>{if(seenVersion.current===release.version)return;seenVersion.current=release.version;refreshAfterMutation();},[release.version,refreshAfterMutation]);

 const result=notes.data&&notes.data!==hidden?notes.data:null,draft=result?.draft??null,owner=release.ownerOperatorId;
 const canMutate=!readOnly&&!!result?.canEdit&&owner!==null;
 const text=edit?.text??draft?.body??'',dirty=!!draft&&!!edit&&edit.text!==draft.body;
 const completed=release.issues.filter(issue=>issue.category==='completed').length;

 async function mutate(kind:'generate'|'save',body:object){
  const ticket=epoch.current;setBusy(kind);setError('');setNotice('');
  try{
   const value=await fetchJson(url,releaseNotesResult,{method:kind==='generate'?'POST':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(ticket!==epoch.current)return null;
   setConflict(false);setLoss(null);notes.publishReceipt(()=>value);notes.refreshAfterMutation();
   return value;
  }catch(cause){
   if(ticket!==epoch.current)return null;
   if(cause instanceof ApiError&&isUnavailableResourceError(cause)){
    // Hide the retained receipt until a fresh read proves current access; the
    // release detail around it is re-read under the same changed access.
    epoch.current++;onStaleRelease();setEdit(null);setConflict(false);setHidden(latest.current);setLoss(cause);notes.reload();
   }else if(cause instanceof ApiError&&cause.status===409){
    setConflict(kind==='save');onStaleRelease();notes.reload();
    setError(kind==='save'?'Not saved: the release or these notes changed after you started editing. Your text is still here.':cause.message);
   }else if(cause instanceof ApiError&&cause.status<500)setError(cause.message);
   else setError(kind==='save'?'The draft could not be saved. Your text is still here; try again.':'The draft could not be generated. Try again.');
   return null;
  }finally{setBusy(null);}
 }
 async function generate(){if(await mutate('generate',{expectedReleaseVersion:release.version}))setNotice('Draft generated and saved.');}
 async function save(){
  if(!edit)return;
  const sent=edit.text,value=await mutate('save',{expectedReleaseVersion:release.version,expectedVersion:edit.base,body:sent});
  const next=value?.draft;if(!next)return;
  setEdit(current=>!current||current.text===sent?null:{text:current.text,base:next.version});setNotice('Draft saved.');
 }
 function change(value:string){
  if(!draft)return;setNotice('');
  setEdit(current=>({text:value,base:current&&current.text!==draft.body?current.base:draft.version}));
 }
 function loadSaved(){setEdit(null);setConflict(false);setError('');setNotice('');notes.reload();}

 const status=busy==='generate'?'Generating draft…':busy==='save'?'Saving draft…':dirty?'Unsaved changes. Select Save draft to keep them.':notice||(draft?'All changes saved.':'');
 const ownsRelease=!!owner&&owner===metadata?.viewer.id;
 const reason=!owner||!result||!metadata?null:readOnly&&result.canEdit?'Editing is off in this read-only view.':result.canEdit?null:ownsRelease?'Your current role cannot generate or edit these notes.':'Only '+memberName(metadata,owner)+' can generate or edit these notes.';
 return <section className="release-section release-notes" aria-labelledby={headingId}>
  <div className="release-notes-title"><h2 id={headingId}>Internal release notes</h2><span className="release-notes-badge">Draft only</span></div>
  <p className="release-notes-context">Visible only inside this workspace. Saving never publishes or sends the notes, and it does not change the release description or Mark Released.</p>
  <p className="release-notes-meta">{owner?<>Release owner: <strong>{memberName(metadata,owner)}</strong></>:'Release owner unavailable.'}</p>
  {!owner&&<p className="release-notes-callout" role="note">This release was created before Vector recorded release owners, so no one can generate or edit its notes.</p>}
  {loss?<p role="alert">{result?'Your access to these notes changed, so your unsaved text was removed from this page.':unavailable(loss)+' Saved and unsaved note text was removed from this page.'}</p>
   :resourceLost&&<p role="alert">{unavailable(notes.error)}</p>}
  {notes.error&&!resourceLost&&<p role="alert">Release notes could not be loaded. {notes.error.message} <button type="button" onClick={notes.reload}>Retry loading notes</button></p>}
  {!result?!notes.error&&!loss&&<p role="status">Loading release notes…</p>:<>
   {reason&&<p className="release-notes-meta">{reason}</p>}
   {draft&&result.releaseChanged&&<p className="release-notes-callout" role="status">The release changed after this draft was generated. The draft keeps its original sources and your text; review it against the current scope.</p>}
   {!draft&&<p>{canMutate?completed?issues(completed)+' in the current scope will be drafted, grouped by project.':'Complete an issue in this release before generating notes.':'No internal draft yet.'}</p>}
   {draft&&<>
    <p className="release-notes-meta">Version {draft.version} · {draft.version===1?'generated':'last saved'} by {memberName(metadata,draft.authorOperatorId)}</p>
    <ReleaseNoteSources sources={draft.sources}/>
    {canMutate?<div className="release-notes-panes">
     <div className="release-notes-field"><label htmlFor={headingId+'-markdown'}>Release notes Markdown</label><textarea id={headingId+'-markdown'} value={text} maxLength={100000} onChange={event=>change(event.target.value)}/></div>
     <DraftPreview text={text}/>
    </div>:<DraftPreview text={draft.body}/>}
   </>}
   {canMutate&&<div className="release-actions">
    {draft?<button type="button" disabled={busy!==null||!dirty} onClick={()=>void save()}>Save draft</button>
     :<button type="button" disabled={busy!==null||completed===0} onClick={()=>void generate()}>Generate draft</button>}
    {/* The row stays mounted from generation to editing, so this live region announces each step. */}
    <p role="status" className={dirty?'release-notes-unsaved':undefined}>{status}</p>
   </div>}
   {error&&<div role="alert" className="release-notes-error"><p>{error}</p>{conflict&&<>
    <p>Reloading the saved draft permanently discards your unsaved text. Copy anything you want to keep first.</p>
    <button type="button" disabled={busy!==null} onClick={loadSaved}>Reload saved draft and discard my text</button>
   </>}</div>}
  </>}
 </section>;
}
