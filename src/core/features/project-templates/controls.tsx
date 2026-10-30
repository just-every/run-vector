import {useId,useState} from 'react';
import {z} from 'zod';
import {fetchJson,useApiResource} from '../../app/api-client';
import {templateSchema,templateListSchema,type TemplateInput} from './schema';
import {workspaceOptionsSchema} from '../../shared/workspace-options';
import {MentionTextarea} from '../notifications/ui/mention-textarea';
import {SafeMarkdown} from '../markdown/ui/markdown';
import './templates.css';
const optionsUrl='/api/project-templates';
const send=(method:string,data:unknown)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
export function SaveProjectTemplate({project}:{project:{id:string;name:string;startDate:string|null}}){
 const [open,setOpen]=useState(false);
 return <div className="project-template-controls"><button type="button" onClick={()=>setOpen(!open)}>Save as template</button>{open&&<CaptureForm project={project} close={()=>setOpen(false)}/>}</div>;
}
function CaptureForm({project,close}:{project:{id:string;name:string;startDate:string|null};close:()=>void}){
 const options=useApiResource(optionsUrl,templateListSchema),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 return <form aria-label="Save project as template" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const data=new FormData(e.currentTarget);try{const result=await fetchJson(optionsUrl+'/from-project/'+project.id,templateSchema,send('POST',{name:data.get('name'),teamId:data.get('team')||null,referenceDate:data.get('reference'),cadence:data.get('cadence')}));setSaved(result.name);}catch(e){setError(e instanceof Error?e.message:'Could not save template.');}finally{setBusy(false);}}}>
  <fieldset disabled={busy||!options.data}><legend>Save project structure</legend><p>Copies description, milestones, project label names and default issue content. Assignees, comments, history and files are excluded.</p>
   <label>Template name<input name="name" required maxLength={120} defaultValue={project.name}/></label>
   <label>Template scope<select aria-label="Template scope" name="team" defaultValue="">{options.data?.workspaceAllowed&&<option value="">Workspace</option>}{options.data?.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
   <label>Reference start date<input name="reference" type="date" required defaultValue={project.startDate??''}/></label>
   <small>Milestone and issue dates become day offsets from this date.</small>
   <label>Update cadence<input name="cadence" maxLength={120} placeholder="For example, every Friday"/></label>
   <small>Stored for planning; automatic updates are not available yet.</small>
   <button>Save project template</button><button type="button" onClick={close}>Close template form</button>
  </fieldset>{(error||options.error)&&<p role="alert">{error||options.error?.message}</p>}{saved&&<p role="status">Template saved: {saved}</p>}
 </form>;
}
export function ProjectTemplateLauncher({onChanged}:{onChanged:()=>void}){
 const [open,setOpen]=useState(false);
 return <div className="administration-panel project-template-controls"><button type="button" onClick={()=>setOpen(!open)}>New project from template</button>{open&&<TemplateLibrary onChanged={onChanged}/>}</div>;
}
function TemplateLibrary({onChanged}:{onChanged:()=>void}){
 // Launch creates native issues; template scope choices are membership-only.
 const issueOptions=useApiResource('/api/options',workspaceOptionsSchema);
 const list=useApiResource(optionsUrl,templateListSchema),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{projectId:string;skippedLabels:string[]}|null>(null),[draft,setDraft]=useState<TemplateInput|null>(null),[confirm,setConfirm]=useState(false);
 const template=list.data?.templates.find(t=>t.id===selected);
 const act=async(run:()=>Promise<void>)=>{setBusy(true);setError('');try{await run();}catch(e){setError(e instanceof Error?e.message:'Template operation failed.');}finally{setBusy(false);}};
 return <div data-project-templates-ready={list.data&&!list.loading?'true':'false'}>
  <h2>Project templates</h2><p>Start a project with relative milestone and issue dates. Template deletion never changes projects already created from it.</p>
  <label>Choose project template<select aria-label="Choose project template" value={selected} onChange={e=>{setSelected(e.target.value);setDraft(null);setResult(null);setConfirm(false);}}><option value="">Choose a template</option>{list.data?.templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
  {list.data?.templates.length===0&&<p>Open a project’s Manage controls and choose Save as template to create the first one.</p>}
  {(error||list.error||issueOptions.error)&&<p role="alert">{error||list.error?.message||issueOptions.error?.message}</p>}
  {template&&!draft&&<>
   <p>{template.milestones.length} milestones · {template.issues.length} default issues · Update cadence: {template.cadence||'Not set'} (stored only)</p>
   <details className="template-preview"><summary>Preview project structure</summary><SafeMarkdown>{template.description||'No description'}</SafeMarkdown><ul>{template.milestones.map((m,i)=><li key={i}>{m.name} · {m.offsetDays===null?'No target':`Day ${m.offsetDays}`}<SafeMarkdown>{m.description}</SafeMarkdown></li>)}</ul><ul>{template.issues.map((i,n)=><li key={n}>{i.title} · {i.offsetDays===null?'No due date':`Day ${i.offsetDays}`}<SafeMarkdown>{i.description}</SafeMarkdown></li>)}</ul><p>Labels: {template.labels.join(', ')||'None'}</p></details>
   <form aria-label="Create project from template" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void act(async()=>{const value=await fetchJson(optionsUrl+'/'+template.id+'/apply',z.object({projectId:z.string(),skippedLabels:z.array(z.string())}),send('POST',{name:data.get('name'),startDate:data.get('start'),teamId:data.get('team'),expectedVersion:template.version}));setResult(value);onChanged();});}}><fieldset disabled={busy||!issueOptions.data}>
    <label>New project name<input name="name" required maxLength={120}/></label><label>New project start date<input type="date" name="start" required/></label><label>Default issue team<select aria-label="Default issue team" name="team" required><option value="">Choose your team</option>{issueOptions.data?.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button>Create project from template</button>
   </fieldset></form>
   {template.canEdit&&<div className="template-actions"><button disabled={busy} onClick={()=>{const {id,version,canEdit,...input}=template;setDraft(input);}}>Edit project template</button><button disabled={busy} onClick={()=>setConfirm(true)}>Delete project template</button></div>}
   {confirm&&<div role="group" aria-label="Confirm template deletion"><p>Delete this template? Existing projects remain unchanged.</p><button disabled={busy} onClick={()=>void act(async()=>{await fetchJson(optionsUrl+'/'+template.id,z.object({deleted:z.boolean()}),send('DELETE',{expectedVersion:template.version}));setSelected('');setConfirm(false);list.reload();})}>Delete template and keep projects</button><button onClick={()=>setConfirm(false)}>Cancel template deletion</button></div>}
  </>}
  {draft&&template&&<TemplateEditor draft={draft} change={setDraft} busy={busy} cancel={()=>setDraft(null)} save={()=>void act(async()=>{await fetchJson(optionsUrl+'/'+template.id,templateSchema,send('PUT',{...draft,labels:draft.labels.map(l=>l.trim()).filter(Boolean),expectedVersion:template.version}));setDraft(null);list.reload();})}/>}
  {result&&<p role="status">Project created. <a href={'/app/projects/'+result.projectId}>Open created project</a>{result.skippedLabels.length>0&&<> Skipped unavailable project labels: {result.skippedLabels.join(', ')}.</>}</p>}
 </div>;
}
function TemplateMarkdownField({label,value,change,disabled}:{label:string;value:string;change:(value:string)=>void;disabled:boolean}){
 const id=useId();
 return <div className="template-markdown-field"><label htmlFor={id}>{label}</label><MentionTextarea id={id} value={value} onValueChange={change} maxLength={100000} rows={5} disabled={disabled}/></div>;
}
function TemplateEditor({draft,change,busy,cancel,save}:{draft:TemplateInput;change:(v:TemplateInput)=>void;busy:boolean;cancel:()=>void;save:()=>void}){
 const offset=(v:string)=>v===''?null:Number(v);
 return <form aria-label="Edit project template" onSubmit={e=>{e.preventDefault();save();}}><fieldset disabled={busy}><legend>Template structure</legend>
  <label>Template name<input required maxLength={120} value={draft.name} onChange={e=>change({...draft,name:e.target.value})}/></label>
  <TemplateMarkdownField label="Template description" value={draft.description} change={description=>change({...draft,description})} disabled={busy}/>
  <label>Update cadence<input maxLength={120} value={draft.cadence} onChange={e=>change({...draft,cadence:e.target.value})}/></label>
  <label>Project label names (one per line)<textarea value={draft.labels.join('\n')} onChange={e=>change({...draft,labels:e.target.value.split('\n')})}/></label>
  {draft.milestones.map((m,i)=><fieldset key={i}><legend>Milestone {i+1}</legend><label>Milestone name<input required value={m.name} onChange={e=>change({...draft,milestones:draft.milestones.map((v,n)=>n===i?{...v,name:e.target.value}:v)})}/></label><TemplateMarkdownField label="Milestone description" value={m.description} change={description=>change({...draft,milestones:draft.milestones.map((v,n)=>n===i?{...v,description}:v)})} disabled={busy}/><label>Target day offset<input type="number" min={-3650} max={3650} value={m.offsetDays??''} onChange={e=>change({...draft,milestones:draft.milestones.map((v,n)=>n===i?{...v,offsetDays:offset(e.target.value)}:v)})}/></label><button type="button" onClick={()=>change({...draft,milestones:draft.milestones.filter((_,n)=>n!==i),issues:draft.issues.map(v=>({...v,milestonePosition:v.milestonePosition===null||v.milestonePosition===i?null:v.milestonePosition>i?v.milestonePosition-1:v.milestonePosition}))})}>Remove milestone {i+1}</button></fieldset>)}
  <button type="button" disabled={draft.milestones.length>=50} onClick={()=>change({...draft,milestones:[...draft.milestones,{name:'',description:'',offsetDays:null}]})}>Add template milestone</button>
  {draft.issues.map((v,i)=><fieldset key={i}><legend>Default issue {i+1}</legend><label>Issue title<input required value={v.title} onChange={e=>change({...draft,issues:draft.issues.map((x,n)=>n===i?{...x,title:e.target.value}:x)})}/></label><TemplateMarkdownField label="Issue Markdown description" value={v.description} change={description=>change({...draft,issues:draft.issues.map((x,n)=>n===i?{...x,description}:x)})} disabled={busy}/><label>Issue priority<select value={v.priority} onChange={e=>change({...draft,issues:draft.issues.map((x,n)=>n===i?{...x,priority:e.target.value as typeof v.priority}:x)})}>{['none','low','medium','high','urgent'].map(p=><option key={p}>{p}</option>)}</select></label><label>Due day offset<input type="number" min={-3650} max={3650} value={v.offsetDays??''} onChange={e=>change({...draft,issues:draft.issues.map((x,n)=>n===i?{...x,offsetDays:offset(e.target.value)}:x)})}/></label><label>Issue milestone<select value={v.milestonePosition??''} onChange={e=>change({...draft,issues:draft.issues.map((x,n)=>n===i?{...x,milestonePosition:offset(e.target.value)}:x)})}><option value="">None</option>{draft.milestones.map((m,n)=><option key={n} value={n}>{n+1}. {m.name}</option>)}</select></label><button type="button" onClick={()=>change({...draft,issues:draft.issues.filter((_,n)=>n!==i)})}>Remove default issue {i+1}</button></fieldset>)}
  <button type="button" disabled={draft.issues.length>=100} onClick={()=>change({...draft,issues:[...draft.issues,{title:'',description:'',priority:'none',offsetDays:null,milestonePosition:null}]})}>Add default issue</button><div className="template-actions"><button>Save template changes</button><button type="button" onClick={cancel}>Cancel template edit</button></div>
 </fieldset></form>;
}
