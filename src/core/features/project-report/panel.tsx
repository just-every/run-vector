import { BurnUp } from "./burn-up";
import type { ProjectReport } from "./schema";
import "./report.css";

export function ProjectReportPanel({ report }: { report: ProjectReport }) {
  const { projection } = report;
  const projectionLabel = projection.status === "projected" ? projection.date!
    : projection.status === "not-enough-history" ? "Not enough history"
    : projection.status === "nothing-remaining" ? "Nothing remaining" : "Final state";
  return <section className="project-report" aria-label="Project report">
    <header className="project-report__heading"><div><h2>Project burn-up</h2>
      <p>Scope and completion by day · issue count · {report.timezone}</p></div>
      <span className="project-report__badge">{report.finalState ? `Frozen · ${report.finalState}` : "Live"}</span>
    </header>
    <p className="project-report__note">Canceled and Duplicate work is excluded from the lines. Scope markers include every recorded addition and removal. Each day shows its closing balance; the last day shows {report.finalState ? "the final project state" : "the latest balance"}.</p>
    <BurnUp report={report} />
    {report.limitations.map(text => <p className="project-report__notice" key={text}>{text}</p>)}
    <h3>{report.finalState ? "Final report" : "Completion projection"}</h3>
    <div className="project-report__metrics">
      <div className="project-report__metric"><strong>{projection.remaining}</strong><span>Remaining issues</span></div>
      <div className="project-report__metric"><strong>{projection.completions}</strong><span>Recorded completions in 28 days</span></div>
      <div className="project-report__metric"><strong>{projectionLabel}</strong><span>Projected completion</span></div>
    </div>
    <p className="project-report__note">Open issues ÷ the trailing 28-day recorded completion rate, rounded up to whole days in {report.timezone}. The window is {projection.windowStart} through {projection.windowEnd}. Each day counts issues entering Completed while in this project, including creation in Completed. Same-day events are deduplicated; completing a reopened issue on a later day counts again. Only recorded closed-day counts enter the rate. Today’s work enters after day close. Fewer than three completions means not enough history. No date is projected when nothing remains or the project is final.</p>
    {report.finalState && <p className="project-report__note">Recorded through {report.days.at(-1)?.date}. Later issue edits and deletions do not change this final report. Reopening the project resumes its live history.</p>}
  </section>;
}
