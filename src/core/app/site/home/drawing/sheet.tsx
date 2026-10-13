import type { CSSProperties, ReactNode } from 'react'

const edges = ['top', 'right', 'bottom', 'left'] as const
const zones = ['25%', '50%', '75%']

/**
 * An engineering sheet: a square double border with zone ticks bridging the gap between the two lines, a hatched square
 * shadow, and room for a title block flush in the inner border's lower-right corner. Square corners tell it from a card.
 */
export function Sheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`vx-sheet${className ? ` ${className}` : ''}`}>
      <span className="vx-sheet-ticks" aria-hidden="true">
        {edges.flatMap((edge) => zones.map((p) => <i key={`${edge}${p}`} className={`vx-tick vx-tick--${edge}`} style={{ '--p': p } as CSSProperties} />))}
      </span>
      <div className="vx-sheet-frame">{children}</div>
    </div>
  )
}

/** The ruled title block: a 2x2 grid of cells (one column of four on phones), ruled in ink. */
export function TitleBlock({ cells }: { cells: { text: string; kind: 'name' | 'file' | 'path' }[] }) {
  return (
    <div className="vx-titleblock">
      {cells.map((cell) => <p key={cell.text} className={`vx-titleblock-cell vx-titleblock-cell--${cell.kind}`}>{cell.text}</p>)}
    </div>
  )
}
