import type { ReactNode } from 'react'

/**
 * A homepage section after the hero: copy on one side (left unless reversed), its one drawing on the other; stacked on
 * phones. A `band` section sits on a full-bleed `--vx-paper-deep` ground.
 */
export function SplitSection({ id, title, children, art, artLabel, reverse = false, band = false }: { id: string; title: string; children: ReactNode; art: ReactNode; artLabel: string; reverse?: boolean; band?: boolean }) {
  return (
    <section id={id} className={`vx-section vx-split${reverse ? ' vx-split--reverse' : ''}${band ? ' vx-band' : ''}`} aria-labelledby={`${id}-title`}>
      <div className="vx-wrap vx-split-grid">
        <div className="vx-split-copy">
          <h2 id={`${id}-title`} className="vx-h2">{title}</h2>
          {children}
        </div>
        <figure className="vx-split-art" aria-label={artLabel}>{art}</figure>
      </div>
    </section>
  )
}

/**
 * A section whose drawing needs the whole width: the heading on the left and its body on the right, then the drawing
 * across the full content width below. Phones stack all three.
 */
export function StackSection({ id, title, body, art, artLabel }: { id: string; title: string; body: string; art: ReactNode; artLabel: string }) {
  return (
    <section id={id} className="vx-section vx-stack" aria-labelledby={`${id}-title`}>
      <div className="vx-wrap">
        <div className="vx-stack-head">
          <h2 id={`${id}-title`} className="vx-h2">{title}</h2>
          <p className="vx-section-body">{body}</p>
        </div>
        <figure className="vx-stack-art" aria-label={artLabel}>{art}</figure>
      </div>
    </section>
  )
}

/** The ruled line between the hero and Current, ending in a registration cross at each side, as on a drawing sheet. */
export function SheetRule() {
  return (
    <div className="vx-wrap" aria-hidden="true">
      <div className="vx-sheet-rule" />
    </div>
  )
}
