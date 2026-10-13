import { links } from '../shell/links'
import { hero as c } from './copy/hero'
import { Flow } from './flow/flow'

/** The alternative line, with each product name it lists set in bold. */
function Alternative() {
  const pattern = new RegExp(`(${c.alternativeNames.join('|')})`)
  return c.alternative.split(pattern).map((part, i) => (c.alternativeNames.some((name) => name === part) ? <strong key={i}>{part}</strong> : part))
}

/** The first view: the headline, the alternative line and the two actions on the left, the drawn path of one report on the right. */
export function Hero() {
  return (
    <section className="vx-hero" aria-labelledby="hero-title">
      <div className="vx-wrap vx-hero-grid">
        <div className="vx-hero-copy">
          <h1 id="hero-title">{c.titleLines.map((line, i) => <span key={line}>{i < c.titleLines.length - 1 ? `${line} ` : line}</span>)}</h1>
          <p className="vx-hero-sub">{c.sub}</p>
          <p className="vx-fine vx-hero-alt"><Alternative /></p>
          <div className="vx-actions">
            <a className="vx-pill vx-pill--large" href={links.source}>{c.primary}</a>
            <a className="vx-link vx-link--large" href={links.docs}>{c.secondary}</a>
          </div>
        </div>
        <Flow />
      </div>
    </section>
  )
}
