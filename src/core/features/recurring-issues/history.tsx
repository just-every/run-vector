import { useDateFormat } from '../../shared/date-format'
import type { Occurrence } from './schema'
import { failureText } from './outcomes'

const issueLink=(issue:{identifier:string;title:string},title=true)=><a href={'/app/issues/'+issue.identifier}><span className="key">{issue.identifier}</span>{title&&' '+issue.title}</a>

/** Latest week first. A receipt names only the issues this reader can currently open. */
export function OccurrenceHistory({history}:{history:Occurrence[]}) {
  const {date}=useDateFormat()
  if(!history.length)return <p className="field-hint">No occurrences yet.</p>
  return <ol className="recurring-history" aria-label="Occurrence history">{history.map(entry=><li key={entry.dueOn}>
    <span className="recurring-week">Week of {date(entry.dueOn)}</span>
    {entry.outcome==='created'&&<span>Created {entry.issue?issueLink(entry.issue):'an issue you cannot open'}
      {entry.children.length>0&&<> with subissues {entry.children.map((child,index)=><span key={child.id}>{index>0&&', '}{issueLink(child,false)}</span>)}</>}</span>}
    {entry.outcome==='skipped'&&<span>Skipped while the previous issue was open</span>}
    {entry.outcome==='failed'&&<span className="recurring-failure">Failed. {failureText(entry.error??'')}</span>}
  </li>)}</ol>
}
