import { useState } from 'react'
import { useApiResource } from '../../app/api-client'
import { workspaceOptionsSchema } from '../../shared/workspace-options'
import { useDateFormat } from '../../shared/date-format'
import { templateListSchema } from '../issue-templates/schema'
import { seriesListSchema } from './schema'
import { SeriesForm } from './series-form'
import { SeriesRow } from './series-row'
import './recurring.css'

/** One team's weekly recurring issues, in its Planning tab, for those who may configure them (`recurring.manage`).
 * The server lists only series the reader may still configure and rechecks every change. */
export function RecurringIssueSettings({teamId}:{teamId:string}) {
  const list=useApiResource('/api/recurring-issues',seriesListSchema,undefined,{abortPendingOnDispose:false})
  const templates=useApiResource('/api/issue-templates',templateListSchema,undefined,{abortPendingOnDispose:false})
  const options=useApiResource('/api/options',workspaceOptionsSchema)
  const {date}=useDateFormat(),[creating,setCreating]=useState(false),[notice,setNotice]=useState('')
  const failure=list.error?.message||templates.error?.message||options.error?.message
  const ready=list.data&&templates.data&&options.data?{series:list.data.series.filter(s=>s.teamId===teamId),
    templates:templates.data.templates.filter(t=>t.teamId===null||t.teamId===teamId),options:options.data}:null
  const changed=(message:string)=>{setNotice(message);list.reload()}
  return <section className="team-block recurring-issues" aria-labelledby="recurring-issues-heading" aria-busy={!ready&&!failure}>
    <h2 className="group-heading" id="recurring-issues-heading">Recurring issues</h2>
    <p className="field-hint">Create an issue from a template every week. Missed weeks are not backfilled.</p>
    {failure&&<p className="confirm-error" role="alert">{failure}</p>}
    {notice&&<p className="field-hint" role="status">{notice}</p>}
    {ready&&<ul className="recurring-rows" aria-label="Recurring issues">{ready.series.map(series=>
      <SeriesRow key={series.id} series={series} templates={ready.templates} options={ready.options} changed={changed}/>)}</ul>}
    {ready&&!creating&&<div className="confirm-actions">
      <button type="button" className="button-quiet" disabled={!ready.templates.length} onClick={()=>{setCreating(true);setNotice('')}}>New recurring issue</button>
      {!ready.templates.length&&<span className="field-hint">Save an issue template first.</span>}
    </div>}
    {ready&&creating&&<SeriesForm teamId={teamId} templates={ready.templates} options={ready.options} cancel={()=>setCreating(false)}
      refused={templates.reload} saved={series=>{setCreating(false);changed(`${series.name} created. First week ${date(series.nextOn)}.`)}}/>}
  </section>
}
