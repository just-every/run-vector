import { product } from '../../copy/product'
import { Keycap } from '../../drawing/keycap'
import { Panel } from './panel'

const c = product.search

/** Search: the ⌘K keycaps, and the command palette they open with two results for "delivery" (command-palette, search data). */
export function SearchPanel() {
  return (
    <Panel id="search" label={c.label} title={c.title} line={c.line}>
      <div className="vx-search">
        <span className="vx-search-keys">{c.keys.map((key) => <Keycap key={key}>{key}</Keycap>)}</span>
        <div className="vx-card vx-palette">
          <div className="vx-card-head vx-palette-query">
            <span className="vx-palette-glyph" aria-hidden="true">⌕</span>
            <span className="vx-palette-text">{c.query}</span>
            <Keycap small>{c.esc}</Keycap>
          </div>
          <p className="vx-palette-group">{c.group}</p>
          {c.results.map((result) => (
            <p key={result.id} className={result.selected ? 'vx-palette-row is-selected' : 'vx-palette-row'}>
              <span className="vx-palette-title">{result.id} · {result.title}</span>
              <span className="vx-palette-kind">{c.kind}</span>
              {result.selected ? <span className="vx-palette-enter" aria-hidden="true">↵</span> : null}
            </p>
          ))}
        </div>
      </div>
    </Panel>
  )
}
