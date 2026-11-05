import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { createUlid } from "../../shared/ids";
import { useHydrated } from "../../app/initial-resources";
import { fetchJson } from "../../app/api-client";
import { useDateFormat } from "../../shared/date-format";
import { MentionTextarea } from "../notifications/ui/mention-textarea";
import { SafeMarkdown } from "../markdown/ui/markdown";
import { activeHealthLabel } from "../projects/ui/helpers";
import type { ProjectDetailData } from "../projects/ui/data";
import { projectUpdateSchema, updateStatusLabels, type ProjectUpdate } from "./schema";
import "./updates.css";

export function ProjectUpdates({project,onChanged}:{project:ProjectDetailData;onChanged:()=>void}) {
  const label=useId(),hydrated=useHydrated(),location=useLocation(),{dateTime}=useDateFormat();
  const [body,setBody]=useState(""),[status,setStatus]=useState<ProjectUpdate['status']>("on-track");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const submitted=useRef<{id:string;body:string;status:ProjectUpdate['status']}|null>(null);
  useEffect(()=>{
    if(location.hash.startsWith('update-'))document.getElementById(location.hash)?.scrollIntoView({block:'center'});
  },[location.hash,project.updates]);
  async function post() {
    if(busy)return;
    setBusy(true);setError("");
    if(!submitted.current||submitted.current.body!==body||submitted.current.status!==status)
      submitted.current={id:createUlid(new Date()),body,status};
    try {
      await fetchJson('/api/projects/'+project.id+'/updates',projectUpdateSchema,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(submitted.current),
      });
      submitted.current=null;setBody('');onChanged();
    } catch(cause) {setError(cause instanceof Error?cause.message:'Could not post the update. Your text is kept.');}
    finally {setBusy(false);}
  }
  return <section className="project-detail__section project-updates" aria-label="Project updates">
    <h2>Project updates</h2>
    <p className="project-updates__health">Computed health: <strong>{activeHealthLabel(project.health)??'No active health'}</strong></p>
    {project.canPostUpdate&&<form aria-label="Post project update" onSubmit={event=>{event.preventDefault();void post();}}>
      <fieldset disabled={busy||!hydrated}>
        <label htmlFor={label+'-status'}>Stated status</label>
        <select id={label+'-status'} value={status} onChange={event=>setStatus(event.target.value as ProjectUpdate['status'])}>
          {Object.entries(updateStatusLabels).map(([value,text])=><option key={value} value={value}>{text}</option>)}
        </select>
        <label htmlFor={label+'-body'}>Update body</label>
        <MentionTextarea id={label+'-body'} aria-label="Update body" value={body} onValueChange={setBody} rows={5} maxLength={50000}/>
        <button type="submit" disabled={!body.trim()}>{busy?'Posting update…':'Post update'}</button>
      </fieldset>
      {error&&<p role="alert">{error}</p>}
    </form>}
    {project.updates.length===0?<p>No updates yet.</p>:<ol className="project-updates__list">
      {project.updates.map(update=><li key={update.id}><article id={'update-'+update.id} tabIndex={-1} aria-label={'Project update '+updateStatusLabels[update.status]}>
        <header><div className="project-updates__comparison"><h3>Stated status: {updateStatusLabels[update.status]}</h3><p>Computed health: <strong>{activeHealthLabel(project.health)??'No active health'}</strong></p></div>
          <p>{update.authorName} · <time dateTime={update.createdAt}>{dateTime(update.createdAt)}</time></p></header>
        <SafeMarkdown>{update.body}</SafeMarkdown>
      </article></li>)}
    </ol>}
  </section>;
}
