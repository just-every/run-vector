import { product } from '../../copy/product'
import { Gauge } from '../../drawing/gauge'
import { Panel } from './panel'

const c = product.cycles

/** Cycles: a protractor at the cycle's progress, with its name, points and capacity (stream-workspace CycleContext). */
export function CyclesPanel() {
  return (
    <Panel id="cycles" label={c.label} title={c.title} line={c.line}>
      <div className="vx-cycle">
        <Gauge percent={c.percent} />
        <strong className="vx-cycle-name">{c.cycle}</strong>
        <span className="vx-cycle-points">{c.progress}</span>
        <span className="vx-cycle-capacity">{c.capacity}</span>
      </div>
    </Panel>
  )
}
