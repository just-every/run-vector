import { useId,useState,type ReactNode } from 'react'
import { z } from 'zod'
import { fetchJson,useApiResource } from '../../app/api-client'
import { workspaceOptionsSchema } from '../../shared/workspace-options'
import { MentionTextarea } from '../notifications/ui/mention-textarea'
import { templateSchema,templateListSchema,type TemplateInput,type IssueTemplate } from './schema'
import type { NewIssueDraft } from '../issues/ui/new-issue-draft'
import '../project-templates/templates.css'

// Unmounted controls retire their state while admitted private reads drain.
const url='/api/issue-templates'
const send=(method:string,body:unknown)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
type Defaults=TemplateInput['defaults']
const blank=():TemplateInput=>({name:'',teamId:null,defaults:{},subissues:[]})

/** One team's issue templates, in its Planning tab: this team's own and the workspace's. The server decides who may change what. */
export function IssueTemplateSettings({teamId}:{teamId:string}) {
  const list=useApiResource(url,templateListSchema,undefined,{abortPendingOnDispose:false}),options=useApiResource('/api/options',workspaceOptionsSchema)
  const [draft,setDraft]=useState<TemplateInput|null>(null),[editing,setEditing]=useState<IssueTemplate|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState(false)
  const reset=()=>{setDraft(null);setEditing(null);setConfirm(false)}
  const act=async(run:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await run();list.reload()}catch(e){setError(e instanceof Error?e.message:'Template change failed.')}finally{setBusy(false)}}
  const team=list.data?.teams.find(t=>t.id===teamId),teamManages=!!team?.canManage,workspaceAllowed=!!list.data?.workspaceAllowed
  const shown=list.data?.templates.filter(t=>t.teamId===null||t.teamId===teamId)??[]
  const failure=error||list.error?.message||options.error?.message
  return <section className="team-block issue-templates" aria-labelledby="issue-templates-heading">
    <h2 className="group-heading" id="issue-templates-heading">Issue templates</h2>
    <p className="field-hint">Save defaults and subissues. Applying defaults keeps fields you have already entered. Deleting a template keeps created issues.</p>
    {failure&&<p className="confirm-error" role="alert">{failure}</p>}{notice&&<p className="field-hint" role="status">{notice}</p>}
    <ul className="template-rows">{shown.map(t=><li key={t.id}><span className="row-main"><span className="row-name">{t.name}</span><span className="row-meta">{t.teamId===null?'Workspace · ':''}{t.subissues.length} subissues</span></span>{t.canEdit&&<button type="button" className="button-text" disabled={busy} onClick={()=>{setDraft({name:t.name,teamId:t.teamId,defaults:t.defaults,subissues:t.subissues});setEditing(t);setConfirm(false);setNotice('')}}>Edit {t.name}</button>}</li>)}</ul>
    {(workspaceAllowed||teamManages)&&!draft&&<div className="confirm-actions"><button type="button" className="button-quiet" onClick={()=>{setDraft({...blank(),teamId:teamManages?teamId:null});setEditing(null)}}>New issue template</button></div>}
    {draft&&options.data&&<form className="issue-template-form" aria-label="Edit issue template" onSubmit={event=>{event.preventDefault();void act(async()=>{const saved=await fetchJson(url+(editing?'/'+editing.id:''),templateSchema,send(editing?'PUT':'POST',{...draft,...(editing?{expectedVersion:editing.version}:{})}));reset();setNotice('Saved '+saved.name+'.')})}}>
      <fieldset disabled={busy}><legend className="visually-hidden">{editing?'Edit template':'New template'}</legend>
        <div className="field"><div className="field-head"><label htmlFor="issue-template-name">Issue template name</label></div><input id="issue-template-name" type="text" required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></div>
        <div className="field"><div className="field-head"><label htmlFor="issue-template-scope">Issue template scope</label></div><select id="issue-template-scope" aria-label="Issue template scope" disabled={!!editing} value={draft.teamId??''} onChange={e=>setDraft({...draft,teamId:e.target.value||null,defaults:{...draft.defaults,statusId:undefined},subissues:draft.subissues.map(s=>({...s,statusId:undefined}))})}>{(workspaceAllowed||draft.teamId===null)&&<option value="">Workspace</option>}{(teamManages||draft.teamId===teamId)&&<option value={teamId}>{team?.name}</option>}</select></div>
        <TemplateFields label="Issue defaults" value={draft.defaults} change={defaults=>setDraft({...draft,defaults})} teamId={draft.teamId} options={options.data!}/>
        {draft.subissues.map((child,index)=><div className="template-subissue" role="group" aria-label={'Subissue '+(index+1)} key={index}><h3 className="template-subissue-title">Subissue {index+1}</h3><TemplateFields label={'Subissue '+(index+1)} value={child} change={value=>setDraft({...draft,subissues:draft.subissues.map((s,i)=>i===index?{...value,title:value.title??''}:s)})} teamId={draft.teamId} options={options.data!}/><div className="confirm-actions"><button type="button" className="button-text" onClick={()=>setDraft({...draft,subissues:draft.subissues.filter((_,i)=>i!==index)})}>Remove subissue {index+1}</button></div></div>)}
        <div className="confirm-actions">
          <button type="submit" className="button-ink">Save issue template</button>
          <button type="button" className="button-text" disabled={draft.subissues.length>=50} onClick={()=>setDraft({...draft,subissues:[...draft.subissues,{title:''}]})}>Add subissue</button>
          <button type="button" className="button-text" onClick={reset}>Cancel template</button>
        </div>
        {editing&&<div className="confirm-actions"><label className="template-check"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>Confirm template deletion</label><button type="button" className="button-danger" disabled={!confirm} onClick={()=>void act(async()=>{await fetchJson(url+'/'+editing.id,z.object({deleted:z.boolean()}),send('DELETE',{expectedVersion:editing.version}));reset();setNotice('Template deleted. Created issues are retained.')})}>Delete issue template</button></div>}
      </fieldset>
    </form>}
  </section>
}
function TemplateFields({label,value,change,teamId,options}:{label:string;value:Defaults;change:(v:Defaults)=>void;teamId:string|null;options:z.infer<typeof workspaceOptionsSchema>}) {
  const edit=(patch:Partial<Defaults>)=>change({...value,...patch}),base=useId()
  const input=(key:string,text:string,control:ReactNode)=><div className="field"><div className="field-head"><label htmlFor={base+key}>{label} {text}</label></div>{control}</div>
  return <div className="template-fields">
    {input('title','title',<input id={base+'title'} type="text" aria-label={label+' title'} maxLength={500} required={label.startsWith('Subissue')} value={value.title??''} onChange={e=>edit({title:e.target.value||undefined})}/>)}
    {input('description','description',<MentionTextarea id={base+'description'} aria-label={label+' description'} maxLength={100000} value={value.description??''} onValueChange={description=>edit({description})}/>)}
    <details className="fold"><summary>{label} properties</summary><div className="template-properties">
      {input('status','status',<select id={base+'status'} aria-label={label+' status'} value={value.statusId??''} onChange={e=>edit({statusId:e.target.value||undefined})}><option value="">Default for selected team</option>{options.statuses.filter(s=>(!teamId||s.teamId===teamId)&&!['intake','duplicate'].includes(s.category)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>)}
      {input('priority','priority',<select id={base+'priority'} aria-label={label+' priority'} value={value.priority??'none'} onChange={e=>edit({priority:e.target.value as Defaults['priority']})}>{['none','low','medium','high','urgent'].map(p=><option key={p} value={p}>{p}</option>)}</select>)}
      {input('assignee','assignee',<select id={base+'assignee'} aria-label={label+' assignee'} value={value.assigneeOperatorId??''} onChange={e=>edit({assigneeOperatorId:e.target.value||null})}><option value="">Unassigned</option>{options.operators.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>)}
      {input('estimate','estimate',<input id={base+'estimate'} aria-label={label+' estimate'} type="number" min={1} max={100} step={1} value={value.estimate??''} onChange={e=>edit({estimate:e.target.value?Number(e.target.value):null})}/>)}
      {input('project','project',<select id={base+'project'} aria-label={label+' project'} value={value.projectId??''} onChange={e=>edit({projectId:e.target.value||null})}><option value="">No project</option>{options.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
      <fieldset className="template-labels"><legend className="field-head">{label} labels</legend>{options.labels.map(l=><label key={l.id} className="template-check"><input type="checkbox" checked={value.labelIds?.includes(l.id)??false} onChange={e=>edit({labelIds:e.target.checked?[...(value.labelIds??[]),l.id]:(value.labelIds??[]).filter(id=>id!==l.id)})}/>{l.name}</label>)}</fieldset>
    </div></details>
  </div>
}

export function IssueTemplateChoice({values,setValues,onApplied,typed,onBusy}:{values:NewIssueDraft;setValues:React.Dispatch<React.SetStateAction<NewIssueDraft>>;onApplied:(t:IssueTemplate)=>void;typed:ReadonlySet<string>;onBusy:(busy:boolean)=>void}) {
  const list=useApiResource(url,templateListSchema,undefined,{abortPendingOnDispose:false}),[chosen,setChosen]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  return <section className="new-issue-section" aria-label="Issue template">
    <label>Issue template<select aria-label="Issue template" value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">No template</option>{list.data?.templates.filter(t=>!t.teamId||t.teamId===values.teamId).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <button type="button" disabled={!chosen||busy} onClick={async()=>{setBusy(true);onBusy(true);setError('');try{
      const t=await fetchJson(url+'/'+chosen,templateSchema)
      setValues(current=>{
        const result={...current},d=t.defaults
        for(const key of ['title','description','statusId','assigneeOperatorId','projectId'] as const)if(!typed.has(key)&&!current[key]&&d[key])result[key]=d[key]!
        if(!typed.has('priority')&&current.priority==='none'&&d.priority)result.priority=d.priority
        if(!typed.has('estimate')&&!current.estimate&&d.estimate)result.estimate=String(d.estimate)
        if(!typed.has('labelIds')&&!current.labelIds.length&&d.labelIds)result.labelIds=[...d.labelIds]
        return result
      });onApplied(t)
    }catch(e){setError(e instanceof Error?e.message:'Template is unavailable.')}finally{setBusy(false);onBusy(false)}}}>Apply template defaults</button>
    {(error||list.error)&&<p role="alert">{error||list.error?.message}</p>}
  </section>
}
