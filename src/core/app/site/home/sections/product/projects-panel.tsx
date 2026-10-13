import { product } from '../../copy/product'
import { FolderIcon, IssueIcon } from '../../drawing/icons'
import { CardHead } from '../../drawing/plate'
import { Leader } from '../../drawing/tag'
import { Panel } from './panel'

const c = product.projects

/**
 * Projects: a project card, and the one issue that puts it at risk, joined by a leader that names the cause
 * (projects service, stream-list). The leader leaves the pill, runs across and drops into the issue card.
 */
export function ProjectsPanel() {
  return (
    <Panel id="projects" label={c.label} title={c.title} line={c.line}>
      <div className="vx-proj">
        <div className="vx-card vx-proj-project">
          <CardHead icon={<FolderIcon />}>{c.title}</CardHead>
          <strong className="vx-proj-name">{c.project}</strong>
          <span className="vx-reason vx-proj-health">{c.health}</span>
        </div>
        <span className="vx-proj-link" aria-hidden="true">
          <Leader className="vx-proj-run" end="none" />
          <Leader dir="v" end="arrow" className="vx-proj-drop" />
          <span className="vx-proj-cause">{c.risk}</span>
        </span>
        <div className="vx-card vx-proj-issue">
          <CardHead icon={<IssueIcon />} mono>{c.identifier}</CardHead>
          <p className="vx-card-title vx-card-title--small">{c.issue}</p>
          <p className="vx-proj-meta">{c.meta}</p>
        </div>
      </div>
    </Panel>
  )
}
