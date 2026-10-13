import type { ReactNode } from 'react'

/** One panel of the sheet: its drawing (a figure that says what it shows), then its title and one line. */
export function Panel({ id, label, title, line, children }: { id: string; label: string; title: string; line: string; children: ReactNode }) {
  return (
    <article className={`vx-panel vx-panel--${id}`}>
      <figure className="vx-panel-art" aria-label={label}>{children}</figure>
      <h3>{title}</h3>
      <p>{line}</p>
    </article>
  )
}
