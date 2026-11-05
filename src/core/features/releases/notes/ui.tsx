import {useEffect,useId,useRef,useState} from 'react';
import {fetchJson,useApiResource} from '../../../app/api-client';
import {useDateFormat} from '../../../shared/date-format';
import {SafeMarkdown} from '../../markdown/ui/markdown';
import {releaseNotesResult,type NoteDraft,type ReleaseNotes} from './schema';
import './notes.css';

const failure=(error:unknown)=>error instanceof Error&&error.message?error.message:'The release notes could not be saved.';

// Each saved revision remounts the editor from the stored text. After a save,
// keyboard focus returns to its disclosure instead of the document body.
function NotesEditor({draft,busy,focus,onSave}:{draft:NoteDraft;busy:boolean;focus:boolean;onSave:(body:string)=>void}){
 const id=useId(),[body,setBody]=useState(draft.body),summary=useRef<HTMLElement>(null);
 useEffect(()=>{if(focus)summary.current?.focus();},[]);
 return <details className="release-notes-editor"><summary ref={summary}>Edit release notes</summary><form onSubmit={e=>{e.preventDefault();onSave(body);}}><fieldset disabled={busy}>
  <label htmlFor={id}>Release notes Markdown</label>
  <textarea id={id} value={body} rows={14} maxLength={100000} onChange={e=>setBody(e.target.value)}/>
  <button type="submit" disabled={body===draft.body}>Save release notes</button>
 </fieldset></form></details>;
}

/** RELEASE-003's internal draft: generated once from the release's completed
 * issues, then edited only by the release owner. Separate from the description
 * and from Mark Released; nothing here publishes or sends the notes. */
export function ReleaseNotesSection({releaseId,releaseVersion,readOnly,onReloadRelease}:{releaseId:string;releaseVersion:number;readOnly:boolean;onReloadRelease:()=>void}){
 const url='/api/releases/'+releaseId+'/notes',notes=useApiResource(url,releaseNotesResult),{dateTime}=useDateFormat(),heading=useId();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[saved,setSaved]=useState(false);
 const value=notes.data,draft=value?.draft??null,editable=!readOnly&&!!value?.canEdit;
 async function send(method:'POST'|'PATCH',input:object,done:(result:ReleaseNotes)=>string){
  setBusy(true);setError('');setStatus('');
  try{
   const result=await fetchJson(url,releaseNotesResult,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   notes.publishReceipt(()=>result);notes.refreshAfterMutation();setStatus(done(result));setSaved(true);
  }catch(cause){setError(failure(cause));}
  finally{setBusy(false);}
 }
 const reload=()=>{setError('');onReloadRelease();notes.reload();};
 // A release edit on this screen can change what the notes were drafted from.
 const drafted=useRef(releaseVersion);
 useEffect(()=>{if(drafted.current!==releaseVersion){drafted.current=releaseVersion;notes.reload();}},[releaseVersion,notes.reload]);
 return <section className="release-section release-notes" aria-labelledby={heading}>
  <h2 id={heading}>Release notes</h2>
  {notes.error&&<p role="alert">{failure(notes.error)} <button type="button" onClick={notes.reload}>Retry</button></p>}
  {!value&&!notes.error&&<p role="status">Loading release notes…</p>}
  {value&&<p className="release-notes-meta">{value.ownerName?'Owner: '+value.ownerName:'No recorded owner'}{draft&&' · Revision '+draft.version+' by '+draft.authorName+' · '+dateTime(draft.updatedAt)}</p>}
  {value&&!draft&&(editable?<>
   <p>Draft internal notes from this release's completed issues, grouped by project.</p>
   <button type="button" disabled={busy} onClick={()=>void send('POST',{expectedReleaseVersion:releaseVersion},result=>'Drafted revision '+result.draft?.version+'.')}>Draft release notes</button>
  </>:<p>No release notes yet.</p>)}
  {draft&&<>
   {value?.releaseChanged&&<p role="note">The release changed after these notes were drafted. Saved text stays as written.</p>}
   <SafeMarkdown>{draft.body}</SafeMarkdown>
   {editable&&<NotesEditor key={draft.version} draft={draft} busy={busy} focus={saved} onSave={body=>void send('PATCH',{expectedReleaseVersion:releaseVersion,expectedVersion:draft.version,body},result=>'Saved revision '+result.draft?.version+'.')}/>}
  </>}
  {status&&<p role="status">{status}</p>}
  {error&&<p role="alert">{error} <button type="button" onClick={reload}>Reload notes</button></p>}
 </section>;
}
