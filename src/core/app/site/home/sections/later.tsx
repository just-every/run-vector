import { later as c } from '../copy/later'
import { DayStrip } from '../drawing/day-strip'
import { FlowArrow, IssueIcon, SavedIcon, SectionIcon } from '../drawing/icons'
import { CardHead } from '../drawing/plate'
import { Leader } from '../drawing/tag'
import { StackSection } from './section'

/** 4. The second differentiator: a deferred report comes back to Needs decision on its own date. */
export function Later() {
  return <StackSection id="later" title={c.title} body={c.body} art={<Deferral />} artLabel={c.drawing.label} />
}

/**
 * FLW-842 out and back, left to right across the page: the Defer decision with its return time and who saved it
 * (decision-panel, decision-confirmation), a leader to the week it is away, the day it comes back, and the issue back
 * under Needs decision (stream-list). It is undecided again, so it is the one card drawn askew.
 */
function Deferral() {
  const d = c.drawing
  return (
    <div className="vx-later">
      <div className="vx-card vx-later-card">
        <CardHead icon={<IssueIcon />} mono>{d.identifier}</CardHead>
        <div className="vx-choices">
          {d.options.map((option) => (
            <span key={option} className={option === d.chosen ? 'vx-choice is-chosen' : 'vx-choice'}>{option}</span>
          ))}
        </div>
        <p className="vx-field-label">{d.field}</p>
        <p className="vx-field">{d.value}</p>
        <p className="vx-saved">
          <SavedIcon />
          <span><strong>{d.saved}</strong> · <span className="vx-actor">{d.actor}</span></span>
        </p>
      </div>
      <Leader className="vx-later-leader vx-later-leader--across" />
      <Leader dir="v" className="vx-later-leader vx-later-leader--down" />
      <DayStrip days={d.days} time={d.time} />
      <FlowArrow className="vx-arrow vx-later-arrow" />
      <div className="vx-card vx-card--askew vx-later-card vx-later-returned">
        <CardHead icon={<SectionIcon />}>{d.section}</CardHead>
        <div className="vx-row">
          <span className="vx-row-id"><span className="vx-dot vx-dot--open" aria-hidden="true" /><span className="vx-id">{d.identifier}</span></span>
          <span className="vx-card-title vx-card-title--small">{d.title}</span>
          <span className="vx-reason vx-reason--waiting">{d.reason}</span>
        </div>
      </div>
    </div>
  )
}
