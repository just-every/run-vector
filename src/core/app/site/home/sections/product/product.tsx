import { product as c } from '../../copy/product'
import { CyclesPanel } from './cycles-panel'
import { HistoryPanel } from './history-panel'
import { ProjectsPanel } from './projects-panel'
import { SearchPanel } from './search-panel'

/** 5. The rest of the product, on a band: one sheet of four panels, each drawn with a different instrument. */
export function Product() {
  return (
    <section id="product" className="vx-section vx-band vx-product" aria-labelledby="product-title">
      <div className="vx-wrap">
        <h2 id="product-title" className="vx-h2">{c.title}</h2>
        <p className="vx-section-body">{c.body}</p>
        <div className="vx-panels">
          <ProjectsPanel />
          <CyclesPanel />
          <HistoryPanel />
          <SearchPanel />
        </div>
      </div>
    </section>
  )
}
