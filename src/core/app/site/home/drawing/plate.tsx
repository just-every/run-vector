import type { ReactNode } from 'react'

/**
 * One drawn card on its construction, as on a draughtsman's plan: a dashed circle round it, extension lines past its
 * edges and a registration cross where they meet. The construction is always square to the page; a card that has not been
 * decided yet (`askew`) is the only thing drawn at an angle.
 */
export function Plate({ children, askew = false, className = '' }: { children: ReactNode; askew?: boolean; className?: string }) {
  return (
    <div className={`vx-plate${askew ? ' vx-plate--askew' : ''}${className ? ` ${className}` : ''}`}>
      <span className="vx-construction" aria-hidden="true">
        <span className="vx-circle" />
        <span className="vx-ext vx-ext--top" />
        <span className="vx-ext vx-ext--bottom" />
        <span className="vx-ext vx-ext--left" />
        <span className="vx-ext vx-ext--right" />
        <span className="vx-cross vx-cross--tl" />
        <span className="vx-cross vx-cross--tr" />
        <span className="vx-cross vx-cross--bl" />
        <span className="vx-cross vx-cross--br" />
      </span>
      {children}
    </div>
  )
}

/** A drawn card's header strip: an icon and its label (a section name, or an issue identifier in mono). */
export function CardHead({ icon, children, mono = false }: { icon: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="vx-card-head">
      {icon}
      <span className={mono ? 'vx-id' : 'vx-card-label'}>{children}</span>
    </div>
  )
}
