import { flow } from '../copy/hero'
import { CardHead } from '../drawing/plate'
import { IssueIcon, SavedIcon } from '../drawing/icons'

// The two product moments, drawn after Vector's own components: an intake issue in Needs decision (stream-list) and the
// triage decision with its saved confirmation (decision-panel, decision-confirmation).

/** 1. The report as it arrives: identifier, title and its reason, Awaiting decision. */
export function ReportCard() {
  return (
    <div className="vx-card vx-card--report">
      <CardHead icon={<IssueIcon />} mono>{flow.identifier}</CardHead>
      <p className="vx-card-title">{flow.title}</p>
      <span className="vx-reason vx-reason--waiting">{flow.report.reason}</span>
    </div>
  )
}

/** 2. The call: Accept chosen from Accept, Defer and Decline, and the saved decision with who made it. */
export function DecisionCard() {
  const d = flow.decision
  return (
    <div className="vx-card vx-card--decision">
      <CardHead icon={<IssueIcon />} mono>{flow.identifier}</CardHead>
      <div className="vx-choices">
        {d.options.map((option) => (
          <span key={option} className={option === d.chosen ? 'vx-choice is-chosen' : 'vx-choice'}>{option}</span>
        ))}
      </div>
      <p className="vx-saved">
        <SavedIcon />
        <span><strong>{d.saved}</strong> · <span className="vx-actor">{d.actor}</span></span>
      </p>
    </div>
  )
}
