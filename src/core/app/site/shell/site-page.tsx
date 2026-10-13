import type { ReactNode } from 'react'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'

type SitePageProps = {
  children: ReactNode
  current?: 'docs'
  signIn?: boolean
  className?: string
}

/** A public page in the homepage's paper, header and footer. */
export function SitePage({ children, current, signIn, className }: SitePageProps) {
  return (
    <div className={`vx-site${className ? ` ${className}` : ''}`}>
      <SiteHeader current={current} signIn={signIn} />
      <main id="main">{children}</main>
      <SiteFooter signIn={signIn} />
    </div>
  )
}
