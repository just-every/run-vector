import { useState } from 'react'
import type { z } from 'zod'
import { fetchJson } from '../../app/api-client'
import { useDateFormat } from '../../shared/date-format'
import type { workspaceOptionsSchema } from '../../shared/workspace-options'
import type { IssueTemplate } from '../issue-templates/schema'
import { seriesSchema,type Series } from './schema'
import { failureText } from './outcomes'
import { OccurrenceHistory } from './history'

type Options=z.infer<typeof workspaceOptionsSchema>
type Stop='paused'|'ended'
const states={enabled:'Active',paused:'Paused',ended:'Ended'} as const
const stops={paused:{verb:'Pause',effect:'Pausing stops future weeks; resuming is not available yet.'},ended:{verb:'End',effect:'Ending stops this series permanently.'}} as const
const named=(list:{id:string;name:string}[],id:string|null|undefined,unset:string)=>id===undefined?unset:id===null?'None':list.find(item=>item.id===id)?.name??'Unavailable'

/** One series: its state and next week, its stop controls, and its configuration and history on demand. */
export function SeriesRow({series,templates,options,changed}:{series:Series;templates:IssueTemplate[];options:Options;changed:(message:string)=>void}) {
  const {date}=useDateFormat()
  const [stop,setStop]=useState<Stop|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const send=(state:Stop)=>{
    setBusy(true);setError('')
    fetchJson('/api/recurring-issues/'+series.id,seriesSchema,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:series.version,state})}).then(
      next=>{setBusy(false);setStop(null);changed(`${next.name} ${state}. Created issues are retained.`)},
      (e:unknown)=>{setBusy(false);setError(e instanceof Error?e.message:'The series did not change.')})
  }
  const progress=series.state!=='enabled'?'No future weeks':series.restoreHeld?'Restored and inactive':'Next '+date(series.nextOn)
  const hidden=<span className="visually-hidden"> {series.name}</span>
  return <li className="recurring-row">
    <div className="recurring-head">
      <span className="row-main"><span className="row-name">{series.name}</span>
        <span className="row-meta">{states[series.state]} · Weekly · {progress}</span>
        {series.lastError&&<span className="row-meta recurring-failure">Last run failed. {failureText(series.lastError)}</span>}
      </span>
      {series.state!=='ended'&&!stop&&<span className="recurring-actions">
        {series.state==='enabled'&&<button type="button" className="button-text" onClick={()=>setStop('paused')}>Pause{hidden}</button>}
        <button type="button" className="button-text" onClick={()=>setStop('ended')}>End{hidden}</button>
      </span>}
    </div>
    {stop&&<div className="recurring-confirm" role="group" aria-label={`${stops[stop].verb} ${series.name}`}>
      <p className="field-hint">{stops[stop].effect} Created issues are retained.</p>
      <div className="confirm-actions">
        <button type="button" className={stop==='ended'?'button-danger':'button-ink'} disabled={busy} onClick={()=>send(stop)}>{stops[stop].verb} series</button>
        <button type="button" className="button-text" disabled={busy} onClick={()=>{setStop(null);setError('')}}>Keep series</button>
      </div>
    </div>}
    {error&&<p className="confirm-error" role="alert">{error}</p>}
    <details className="fold recurring-details"><summary>Configuration and history<span className="visually-hidden"> for {series.name}</span></summary>
      <dl className="recurring-configuration">
        <dt>Template</dt><dd>{templates.find(t=>t.id===series.templateId)?.name??'Unavailable template'} · version {series.templateVersion}</dd>
        <dt>Configured by</dt><dd>{named(options.operators,series.configuringPersonId,'')}</dd>
        <dt>Starts</dt><dd>{date(series.startsOn)} · midnight in {series.timezone}</dd>
        <dt>Due</dt><dd>{series.dueOffsetDays===null?'No due date':`${series.dueOffsetDays} days after each week starts`}</dd>
        <dt>Assignee</dt><dd>{named(options.operators,series.overrides.assigneeOperatorId,'From template')}</dd>
        <dt>Project</dt><dd>{named(options.projects,series.overrides.projectId,'From template')}</dd>
        <dt>Open issues</dt><dd>{series.skipWhileOpen?'Skips a week while the previous issue is open':'Creates every week'}</dd>
      </dl>
      <OccurrenceHistory history={series.history}/>
    </details>
  </li>
}
