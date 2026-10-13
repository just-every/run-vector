/**
 * A numbered tag on a leader line: a pentagon pointing at what it marks, with its number as real text. Tags and
 * leaders are ink, never cobalt; they are the drafting device of Current, the Projects panel and the deferral's time.
 */
export function Tag({ n }: { n: number }) {
  return (
    <span className="vx-tag">
      <svg viewBox="0 0 34 24" focusable="false" aria-hidden="true"><path d="M0.7 12 8 0.65H33.35V23.35H8Z" /></svg>
      <span className="vx-tag-n">{n}</span>
    </span>
  )
}

/** A 1px ink leader, horizontal (`h`) or vertical (`v`), starting on a filled dot, ending in an open arrowhead, or plain. */
export function Leader({ dir = 'h', end = 'dot', className = '' }: { dir?: 'h' | 'v'; end?: 'dot' | 'arrow' | 'none'; className?: string }) {
  return <span className={`vx-leader vx-leader--${dir} vx-leader--${end}${className ? ` ${className}` : ''}`} aria-hidden="true" />
}
