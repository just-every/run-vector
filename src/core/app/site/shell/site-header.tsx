import { BrandMark } from './brand-mark'
import { links } from './links'

type SiteHeaderProps = {
  /** The page the visitor is on, marked in the nav. */
  current?: 'docs'
  /** The Sign in pill; off on the sign-in page itself and on pages for a signed-in owner. */
  signIn?: boolean
}

/** The header on every public page: the lockup on the left; Docs, Source and Sign in on the right, in one row on phones too. */
export function SiteHeader({ current, signIn = true }: SiteHeaderProps) {
  return (
    <header className="vx-header">
      <div className="vx-wrap">
        <div className="vx-header-row">
          <a className="vx-brand" href={links.home} aria-label="Vector home">
            <BrandMark />
            <span className="vx-brand-name">Vector</span>
          </a>
          <nav aria-label="Main">
            <a href={links.docs} aria-current={current === 'docs' ? 'page' : undefined}>Docs</a>
            <a href={links.source}>Source</a>
            {signIn ? <a className="vx-pill" href={links.signIn}>Sign in</a> : null}
          </nav>
        </div>
      </div>
    </header>
  )
}
