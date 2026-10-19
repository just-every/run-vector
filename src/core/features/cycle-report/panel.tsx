import { BurnUp } from "./burn-up";
import type { CycleReport } from "./schema";
import "./report.css";

export function CycleReportPanel({ report, closed, rolloverFailed }: {
  report: CycleReport; closed: boolean; rolloverFailed: boolean;
}) {
  const carriedLabel = rolloverFailed ? "Unfinished · uncommitted" : closed ? "Carried over" : "Unfinished";
  return <section className="cycle-report" aria-label="Cycle report">
    <header className="cycle-report__heading"><div><h2>Cycle burn-up</h2><p>Scope and completion by day · issue count · {report.timezone}</p></div><span className="cycle-report__badge">{closed ? "Frozen at close" : "Live"}</span></header>
    <p className="cycle-report__note">Canceled and Duplicate work is excluded from the lines. Scope markers include every recorded addition and removal. Each day shows its closing balance; the last day shows {closed ? "the closure snapshot" : "the latest balance"}.</p>
    <BurnUp report={report} />
    {report.limitations.map(text => <p className="cycle-report__notice" key={text}>{text}</p>)}
    <h3>{closed ? "Final report" : "Current scope report"}</h3>
    <div className="cycle-report__metrics">
      <Metric label="Completed" identifiers={report.completed} />
      <Metric label={carriedLabel} identifiers={report.carried} />
      <Metric label="Added mid-cycle" identifiers={report.addedMidcycle} />
    </div>
    <p className="cycle-report__note">Added mid-cycle counts distinct issues added after the start, including work later removed. {closed ? "Assignees and outcomes reflect the moment of closure." : "Assignees and outcomes reflect current commitments."}</p>
    {report.other.length > 0 && <details><summary>Other committed work ({report.other.length})</summary><p>{report.other.join(", ")}</p><p>Intake, Backlog, Canceled and Duplicate work is uncommitted at closure.</p></details>}
    <div className="cycle-report__table" role="region" aria-label="Cycle report by assignee" tabIndex={0}>
      <table><caption>By assignee · committed work {closed ? "at close" : "now"}</caption>
        <thead><tr><th>Assignee</th><th>Completed</th><th>{carriedLabel}</th><th>Other</th><th>Added mid-cycle</th></tr></thead>
        <tbody>{report.byAssignee.map((row, index) => <tr key={row.id ?? `${row.name}-${index}`}><th scope="row">{row.name}</th><td>{row.completed}</td><td>{row.carried}</td><td>{row.other}</td><td>{row.addedMidcycle}</td></tr>)}</tbody>
      </table>
    </div>
    {!report.byAssignee.length && <p>No committed work to group by assignee.</p>}
  </section>;
}

function Metric({ label, identifiers }: { label: string; identifiers: string[] }) {
  return <div className="cycle-report__metric"><strong>{identifiers.length}</strong><span>{label}</span>
    {identifiers.length > 0 && <details><summary>View issues</summary><p>{identifiers.join(", ")}</p></details>}
  </div>;
}
