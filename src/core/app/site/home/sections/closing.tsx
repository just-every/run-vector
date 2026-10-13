import { links } from '../../shell/links'
import { closing as c } from '../copy/closing'

/** 7. The closing call to action, centred, over the same dimension line the hero numbers its steps on. */
export function Closing() {
  return (
    <section id="get-started" className="vx-section vx-closing" aria-labelledby="get-started-title">
      <div className="vx-wrap">
        <h2 id="get-started-title" className="vx-h2 vx-closing-title">{c.title}</h2>
        <svg className="vx-closing-line" viewBox="0 0 320 14" aria-hidden="true" focusable="false">
          <path d="M1 1v12M1 7h316M309 1.5l8 5.5-8 5.5" />
        </svg>
        <div className="vx-actions vx-closing-actions">
          <a className="vx-pill vx-pill--large" href={links.source}>{c.primary}</a>
          <a className="vx-link vx-link--large" href={links.docs}>{c.secondary}</a>
        </div>
        <p className="vx-fine">{c.fine}</p>
      </div>
    </section>
  )
}
