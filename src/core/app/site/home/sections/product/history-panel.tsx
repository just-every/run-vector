import { product } from '../../copy/product'
import { HistoryIcon } from '../../drawing/icons'
import { CardHead } from '../../drawing/plate'
import { Panel } from './panel'

const c = product.history

/** History: FLW-842's decision history as a revision table, ruled between its columns and rows (issue-detail). */
export function HistoryPanel() {
  return (
    <Panel id="history" label={c.label} title={c.title} line={c.line}>
      <div className="vx-card vx-ledger-card">
        <CardHead icon={<HistoryIcon />}>{c.head}</CardHead>
        <table className="vx-ledger">
          <tbody>
            {c.rows.map((row) => (
              <tr key={row.kind}>
                <td><span className={row.done ? 'vx-dot' : 'vx-dot vx-dot--open'} aria-hidden="true" /><strong>{row.kind}</strong></td>
                <td>{row.actor}</td>
                <td>{row.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
