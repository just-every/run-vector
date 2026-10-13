import { links } from '../../shell/links'
import { free as c } from '../copy/free'
import { NoFeesIcon, NoPlansIcon, NoSeatsIcon, SavedIcon } from '../drawing/icons'
import { Sheet, TitleBlock } from '../drawing/sheet'
import { SplitSection } from './section'

const proofIcons = [<NoSeatsIcon key="seats" />, <NoPlansIcon key="plans" />, <NoFeesIcon key="fees" />]

/** 3. Free: 100% free and open source, said plainly, beside the licence itself drawn as a sheet. */
export function Free({ site = false }: { site?: boolean }) {
  return (
    <SplitSection id="free" title={c.title} art={<LicenceSheet />} artLabel={c.licence.label} band>
      <p className="vx-section-body">{c.body}</p>
      <ul className="vx-proof">
        {c.proof.map((item, i) => <li key={item}>{proofIcons[i]}<span>{item}</span></li>)}
      </ul>
      <div className="vx-section-actions">
        <a className="vx-pill vx-pill--large" href={site ? "/run" : links.source}>{site ? "Run Vector" : c.action}</a>
      </div>
    </SplitSection>
  )
}

/** The real LICENSE file, drawn on a sheet: the grant with "free of charge" underlined, and the title block that names it. */
function LicenceSheet() {
  const l = c.licence
  return (
    <Sheet className="vx-licence">
      <p className="vx-licence-text">{l.grant[0]}<span className="vx-mark">{l.grant[1]}</span>{l.grant[2]}</p>
      <p className="vx-licence-text vx-licence-gap" aria-hidden="true">…</p>
      <p className="vx-licence-text vx-licence-rights">{l.rights}<SavedIcon /></p>
      <TitleBlock cells={[
        { text: l.block.title, kind: 'name' },
        { text: l.block.file, kind: 'file' },
        { text: l.block.repo, kind: 'path' },
        { text: l.block.field, kind: 'path' },
      ]} />
    </Sheet>
  )
}
