import type { CSSProperties, ReactNode } from 'react'
import { flow } from '../copy/hero'
import { Plate } from '../drawing/plate'
import { FlowArrow } from '../drawing/icons'
import { DecisionCard, ReportCard } from './cards'

const cards: { card: ReactNode; askew: boolean }[] = [
  { card: <ReportCard />, askew: true },
  { card: <DecisionCard />, askew: false },
]

/**
 * The hero drawing: one report's path, drawn as a draughtsman's plan. Each card sits on its own construction; the report
 * arrives askew and, once the call is made, the card after it sits square on the grid. A cobalt arrow carries it along,
 * and a dimension line under the cards numbers the two steps. Everything is real text in the server HTML; with motion
 * allowed the plan is drawn once on load (flow.css). The board is exactly as wide and tall as what is painted, so the
 * hero can centre it on the copy.
 */
export function Flow() {
  return (
    <figure className="vx-flow" aria-label={flow.label}>
      <div className="vx-board">
        <ol className="vx-steps">
          {cards.map(({ card, askew }, i) => (
            <li key={i} className="vx-step" style={{ '--i': i } as CSSProperties}>
              <div className="vx-step-art">
                <Plate askew={askew}>{card}</Plate>
                {i < cards.length - 1 ? <FlowArrow /> : null}
              </div>
              <p className="vx-caption">
                <span className="vx-num">{i + 1}</span>
                <span className="vx-caption-text">{flow.captions[i]}</span>
              </p>
            </li>
          ))}
        </ol>
        <svg className="vx-dimension" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d="M0.4 1v12M0.4 7H99.4" vectorEffect="non-scaling-stroke" />
        </svg>
        <svg className="vx-dimension-head" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
          <path d="M1 1.5 11 7 1 12.5" />
        </svg>
      </div>
    </figure>
  )
}
