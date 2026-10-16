import { importFieldLabel } from '../import/field-labels';
import { JiraLossReview } from './jira-loss-review';
import type { ImportReportData } from './import-client';
const names={team:'Team',status:'Status',project:'Project',cycle:'Cycle',assignee:'Assignee'} as const;
const rows=(list:number[])=>'row '+list.slice(0,12).join(', ')+(list.length>12?` and ${list.length-12} more`:'');
/** DATA-007: one page that separates what was read, written, omitted and absent. */
export function ImportReport({report,onDownload,onClose}:{report:ImportReportData;onDownload:()=>void;onClose:()=>void}) {
 const {totals}=report;
 return <section className="import-report" aria-labelledby="import-report-heading"><h3 id="import-report-heading">Reconciliation report: {report.run.source}</h3>
  <ul>
   <li><strong>Read:</strong> {totals.rowsRead} source rows from {report.run.fileName}.</li>
   <li><strong>Written:</strong> {totals.issuesWritten} Vector issues{totals.rowsNotWritten?`; ${totals.rowsNotWritten} rows not written yet (the run is ${report.run.state.replaceAll('_',' ')})`:''}.</li>
   <li><strong>Not imported, kept in the original file:</strong> {totals.omittedValues} values in {report.omitted.length} {report.omitted.length===1?'field':'fields'}.</li>
   <li><strong>Not resolved:</strong> {totals.unresolvedReferences} references, listed below with their rows.</li>
   <li><strong>Not in this file at all:</strong> {report.notInFile.join('; ')}.</li>
  </ul>
  {report.effects&&<><table><caption>Planned changes and current Vector records</caption><thead><tr><th>Effect</th><th>Planned</th><th>Written</th></tr></thead><tbody>{Object.entries(report.effects.counts).map(([name,count])=><tr key={name}><td>{name}</td><td>{count.planned}</td><td>{count.written}</td></tr>)}</tbody></table><table><caption>Label assignments</caption><thead><tr><th>Label</th><th>Planned</th><th>Written</th></tr></thead><tbody>{report.effects.labels.map(label=><tr key={label.name}><td>{label.name}</td><td>{label.planned}</td><td>{label.written}</td></tr>)}</tbody></table></>}
  {report.jiraReview&&<JiraLossReview review={report.jiraReview}/>}
  <button type="button" onClick={onDownload}>Download report CSV (source ID to Vector identifier)</button><button type="button" onClick={onClose}>Close report</button>
  {(Object.keys(names) as (keyof typeof names)[]).map(field=><div key={field} className="import-report-table"><table><caption>{names[field]}: read and written</caption><thead><tr><th scope="col">In the file</th><th scope="col">Read</th><th scope="col">Written</th><th scope="col">In Vector</th></tr></thead>
   <tbody>{report.dimensions[field].map(group=><tr key={group.source}><td>{group.source||'(empty)'}</td><td>{group.read}</td><td>{group.written}</td><td>{group.vector.map(value=>group.vector.length>1?`${value.name} (${value.count})`:value.name).join(', ')}</td></tr>)}</tbody></table></div>)}
  {report.omitted.length>0&&<><h4>Not imported, kept in the original file</h4><ul>{report.omitted.map(group=><li key={(group.field??'')+group.code+group.message}>{group.field?importFieldLabel(group.field)+': ':''}{group.message} · {group.count} ({rows(group.rows)})</li>)}</ul></>}
  {report.references.length>0&&<><h4>Unresolved or ignored references</h4><ul>{report.references.slice(0,200).map(item=><li key={item.row+item.code}>Row {item.row} ({item.sourceId}{item.sourceKey?` · ${item.sourceKey}`:''}) · {item.field?importFieldLabel(item.field):'Value'}: {item.value||'(empty)'} · {item.message}</li>)}</ul>{report.references.length>200&&<p>{report.references.length-200} more are in the CSV.</p>}</>}
 </section>;
}
