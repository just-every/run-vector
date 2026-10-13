import { current as c } from '../copy/current'
import { SectionIcon } from '../drawing/icons'
import { CardHead } from '../drawing/plate'
import { Leader, Tag } from '../drawing/tag'
import { SplitSection } from './section'

/** 2. Current: the one list a team shares, and why every issue is in the section it is in. */
export function Current() {
  return (
    <SplitSection id="current" title={c.title} art={<CurrentCard />} artLabel={c.drawing.label} reverse>
      <p className="vx-section-body">{c.body}</p>
      <ol className="vx-key-list">
        {c.key.map((entry, i) => (
          <li key={entry.lead}>
            <Tag n={i + 1} />
            <p><strong>{entry.lead}</strong> {entry.line}</p>
          </li>
        ))}
      </ol>
    </SplitSection>
  )
}

/**
 * Current as it stands once FLW-842 is accepted (stream-workspace, stream-list, helpers). Four sections, each with the
 * reason its issues are there; a numbered tag on an ink leader marks each section and matches the key beside it.
 */
function CurrentCard() {
  const d = c.drawing
  return (
    <div className="vx-cur">
      <div className="vx-card vx-cur-card">
        <CardHead icon={<SectionIcon />}>{d.title}</CardHead>
        {d.sections.map((section, i) => (
          <section key={section.name} className="vx-cur-sec">
            <h3 className="vx-cur-title">
              {section.name}
              <span className="vx-cur-mark"><Leader /><Tag n={i + 1} /></span>
            </h3>
            {section.rows.length === 0 ? <p className="vx-cur-empty">{d.empty}</p> : null}
            {section.rows.map((row) => (
              <div key={row.id} className="vx-cur-row">
                <span className="vx-id">{row.id}</span>
                <span className="vx-reason">{row.reason}</span>
                {'context' in row ? <span className="vx-reason vx-reason--context">{row.context}</span> : null}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
