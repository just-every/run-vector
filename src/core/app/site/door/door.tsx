import type { ReactNode } from 'react'
import { productConfig } from '../../config'
import { SitePage } from '../shell/site-page'

type DoorProps = {
  children: ReactNode
  /** One drawing beside the copy, as in the hero; none on a page that only reports a state. */
  drawing?: ReactNode
  signIn?: boolean
}

/**
 * The public pages a person passes through on the way into the app (sign-in, first-run setup, page not found): the
 * hero's column and rhythm on the left, one drawing on its construction on the right (12ui picks in the brand-vector-s3
 * evidence: pick-signin-A.png, pick-setup-C.png).
 */
export function Door({ children, drawing, signIn = false }: DoorProps) {
  return (
    <SitePage signIn={signIn} className="vx-door-page">
      <section className={`vx-door${drawing ? '' : ' vx-door--plain'}`}>
        <div className="vx-wrap vx-door-grid">
          <div className="vx-door-copy">{children}</div>
          {drawing ? <div className="vx-door-art">{drawing}</div> : null}
        </div>
      </section>
      {productConfig.showPoweredByCredit ? (
        <p className="vx-wrap vx-door-credit">
          Powered by {productConfig.productName} · <a href="https://runeditrun.com">runeditrun.com</a>
        </p>
      ) : null}
    </SitePage>
  )
}
