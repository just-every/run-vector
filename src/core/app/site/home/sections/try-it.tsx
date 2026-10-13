import { links } from '../../shell/links'
import { tryIt as c } from '../copy/try-it'
import { TerminalIcon } from '../drawing/icons'
import { CardHead } from '../drawing/plate'
import { SplitSection } from './section'

/** 6. Try it without switching: three steps, and the three commands with the screen they open. */
export function TryIt() {
  return (
    <SplitSection id="try" title={c.title} art={<Setup />} artLabel={c.drawing.label}>
      <p className="vx-section-body">{c.intro}</p>
      <ol className="vx-try-steps">
        {c.steps.map((step, i) => (
          <li key={step.lead}>
            <span className="vx-num" aria-hidden="true">{i + 1}</span>
            <p><strong>{step.lead}</strong> {step.line}</p>
          </li>
        ))}
      </ol>
      <div className="vx-section-actions">
        <a className="vx-link vx-link--large" href={links.installer}>{c.link}</a>
      </div>
    </SplitSection>
  )
}

/**
 * A patch of grid paper holding a terminal with the README's three commands, overlapped by the first-run screen they
 * open (first-run page). Nothing here is chosen or carried, so there is no cobalt.
 */
function Setup() {
  const d = c.drawing
  return (
    <div className="vx-grid-paper">
      <div className="vx-card vx-terminal">
        <CardHead icon={<TerminalIcon />} mono>{d.terminal}</CardHead>
        <div className="vx-terminal-body">
          {d.commands.map((command) => (
            <p key={command} className="vx-terminal-line">
              <span className="vx-prompt">$ </span>
              {command.split(' ').map((word, i) => <span key={i}>{i > 0 ? ' ' : ''}<span className="vx-terminal-word">{word}</span></span>)}
            </p>
          ))}
        </div>
      </div>
      <div className="vx-card vx-first-run">
        <p className="vx-first-kicker">{d.kicker}</p>
        <p className="vx-first-title">{d.heading}</p>
        <span className="vx-pill vx-first-button">{d.button}</span>
      </div>
    </div>
  )
}
