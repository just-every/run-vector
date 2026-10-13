import { HydrationUnit } from '../../../../base/hydration/unit'
import { BrandMark } from './brand-mark'
import { links } from './links'

/** The footer on every public page: the lockup, the same links as the header and the licence. Like the header, it drops
 *  Sign in on pages for someone already signed in. */
export function SiteFooter({ signIn = true }: { signIn?: boolean }) {
  return (
    <HydrationUnit>
      <footer className="vx-footer">
        <div className="vx-wrap">
          <div className="vx-footer-row">
            <a className="vx-brand vx-brand--small" href={links.home} aria-label="Vector home">
              <BrandMark />
              <span className="vx-brand-name">Vector</span>
            </a>
            <nav aria-label="Footer">
              <a href={links.docs}>Docs</a>
              <a href={links.source}>Source</a>
              {signIn ? <a href={links.signIn}>Sign in</a> : null}
              <a className="vx-pill vx-pill--outline" href={links.licence}>MIT licence</a>
            </nav>
          </div>
        </div>
      </footer>
    </HydrationUnit>
  )
}
