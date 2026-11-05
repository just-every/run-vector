import { useId,useState } from 'react'
import type { z } from 'zod'
import { fetchJson } from '../../app/api-client'
import type { workspaceOptionsSchema } from '../../shared/workspace-options'
import type { IssueTemplate } from '../issue-templates/schema'
import { seriesSchema,type Series } from './schema'

type Options=z.infer<typeof workspaceOptionsSchema>
const blank={name:'',templateId:'',startsOn:'',dueOffset:'',assignee:'',project:'',skipWhileOpen:false}
const weekday=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)?new Intl.DateTimeFormat(undefined,{weekday:'long',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z')):''

/** Configure one weekly series from a current native template. Assignee and project left on the template keep its values. */
export function SeriesForm({teamId,templates,options,cancel,saved,refused}:{teamId:string;templates:IssueTemplate[];options:Options;cancel:()=>void;saved:(series:Series)=>void;refused:()=>void}) {
  const id=useId(),[draft,setDraft]=useState(blank),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const edit=(patch:Partial<typeof blank>)=>setDraft({...draft,...patch})
  const template=templates.find(t=>t.id===draft.templateId),day=weekday(draft.startsOn)
  const field=(key:string,label:string,control:React.ReactNode,hint?:string)=><div className="field"><div className="field-head"><label htmlFor={id+key}>{label}</label></div>{control}{hint&&<p className="field-hint" id={id+key+'hint'}>{hint}</p>}</div>
  return <form className="issue-template-form recurring-form" aria-label="New recurring issue" onSubmit={event=>{
    event.preventDefault();if(!template)return
    setBusy(true);setError('')
    const overrides={...(draft.assignee?{assigneeOperatorId:draft.assignee}:{}),...(draft.project?{projectId:draft.project}:{})}
    const body={name:draft.name,teamId,templateId:template.id,templateVersion:template.version,cadence:'weekly',startsOn:draft.startsOn,
      dueOffsetDays:draft.dueOffset===''?null:Number(draft.dueOffset),skipWhileOpen:draft.skipWhileOpen,overrides}
    fetchJson('/api/recurring-issues',seriesSchema,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(saved,(e:unknown)=>{
      setBusy(false);setError(e instanceof Error?e.message:'The recurring issue was not created.');refused()
    })
  }}>
    <fieldset disabled={busy}><legend className="visually-hidden">New recurring issue</legend>
      {field('name','Recurring issue name',<input id={id+'name'} type="text" required autoFocus maxLength={120} value={draft.name} onChange={e=>edit({name:e.target.value})}/>)}
      {field('template','Recurring issue template',<select id={id+'template'} required value={draft.templateId} onChange={e=>edit({templateId:e.target.value})}><option value="">Choose a template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>,
        template&&`${template.subissues.length} subissues · version ${template.version}`)}
      {field('start','First occurrence',<input id={id+'start'} type="date" required aria-describedby={id+'starthint'} value={draft.startsOn} onChange={e=>edit({startsOn:e.target.value})}/>,
        day?`Repeats every ${day} at midnight in the workspace timezone.`:'Repeats every week on this day.')}
      {field('due','Due offset in days',<input id={id+'due'} type="number" min={0} max={365} step={1} placeholder="No due date" value={draft.dueOffset} onChange={e=>edit({dueOffset:e.target.value})}/>)}
      {field('assignee','Recurring issue assignee',<select id={id+'assignee'} value={draft.assignee} onChange={e=>edit({assignee:e.target.value})}><option value="">Template assignee</option>{options.operators.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>)}
      {field('project','Recurring issue project',<select id={id+'project'} value={draft.project} onChange={e=>edit({project:e.target.value})}><option value="">Template project</option>{options.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
      <label className="template-check"><input type="checkbox" checked={draft.skipWhileOpen} onChange={e=>edit({skipWhileOpen:e.target.checked})}/>Skip a week while the previous issue is open</label>
      <div className="confirm-actions">
        <button type="submit" className="button-ink" disabled={!template}>Create recurring issue</button>
        <button type="button" className="button-text" onClick={cancel}>Cancel recurring issue</button>
      </div>
      {error&&<p className="confirm-error" role="alert">{error}</p>}
    </fieldset>
  </form>
}
