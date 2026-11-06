import {useEffect,useState} from 'react';
import {z} from 'zod';
import {fetchJson,useApiResource} from '../../app/api-client';
import {useNavigate} from '@tanstack/react-router';
const row=z.object({id:z.string(),projectId:z.string(),version:z.number(),name:z.string(),deletedAt:z.string(),retainUntil:z.string(),actorName:z.string().nullable()});
const list=z.object({projects:z.array(row)});
const result=z.object({projectId:z.string()});
import {receiptSchema} from './receipt';
export function RecentlyDeletedProjects() {
 const data=useApiResource('/api/projects/recently-deleted',list);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const navigate=useNavigate();
 async function restore(project:z.infer<typeof row>) {
  if(busy)return;setBusy(true);setError('');
  try{const restored=await fetchJson('/api/projects/restore',result,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:project.id,version:project.version})});data.reload();await navigate({to:'/app/projects/$projectId',params:{projectId:restored.projectId}});}
  catch(cause){setError(cause instanceof Error?cause.message:'Recovery failed.');data.reload();}
  finally{setBusy(false);}
 }
 return <section aria-label="Recently deleted projects"><h2>Recently deleted projects</h2>
  <p>Projects remain recoverable for 30 days. Their issues stay in Vector.</p>
  {(error||data.error)&&<p role="alert">{error||data.error?.message}</p>}
  {data.loading&&!data.data&&<p role="status">Loading deleted projects…</p>}
  {data.data?.projects.length===0&&<p>No recently deleted projects.</p>}
  <ul className="project-fact-list">{data.data?.projects.map(project=><li key={project.id}><strong>{project.name}</strong><span>Deleted by {project.actorName??'Removed operator'} · <time dateTime={project.deletedAt}>{new Date(project.deletedAt).toLocaleString()}</time></span><button type="button" disabled={busy} onClick={()=>void restore(project)}>Restore {project.name}</button></li>)}</ul>
 </section>;
}
export function ProjectUndoNotice() {
 const [receipt,setReceipt]=useState<z.infer<typeof receiptSchema>|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const navigate=useNavigate();
 useEffect(()=>{
  const receive=(event:Event)=>{const parsed=receiptSchema.safeParse((event as CustomEvent).detail);if(parsed.success){setReceipt(parsed.data);setError('');}};
  const clear=()=>{setReceipt(null);setError('');};
  window.addEventListener('vector:project-undo',receive);window.addEventListener('vector:auth-lost',clear);
  return()=>{window.removeEventListener('vector:project-undo',receive);window.removeEventListener('vector:auth-lost',clear);};
 },[]);
 useEffect(()=>{if(!receipt)return;const timer=window.setTimeout(()=>setReceipt(null),Math.max(0,receipt.expiresAt-Date.now()));return()=>window.clearTimeout(timer);},[receipt]);
 async function undo(){if(!receipt||busy)return;setBusy(true);setError('');try{const restored=await fetchJson('/api/projects/undo-deletion',result,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:receipt.id,version:receipt.version})});setReceipt(null);await navigate({to:'/app/projects/$projectId',params:{projectId:restored.projectId}});}catch(cause){setError(cause instanceof Error?cause.message:'Nothing changed.');setReceipt(null);}finally{setBusy(false);}}
 if(!receipt&&!error)return null;
 return <section className="issue-undo-notice" aria-label="Project deletion Undo" aria-live="polite">{receipt&&<><strong>Project moved to Recently deleted.</strong><button type="button" disabled={busy} onClick={()=>void undo()}>Undo project deletion</button></>}{error&&<p role="alert">{error}</p>}<a href="/app/settings/workspace">Recently deleted projects</a><button type="button" onClick={()=>{setReceipt(null);setError('');}}>Dismiss</button></section>;
}
