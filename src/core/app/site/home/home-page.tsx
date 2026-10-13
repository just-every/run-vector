import { SiteFooter } from '../shell/site-footer'
import { SiteHeader } from '../shell/site-header'
import { Hero } from './hero'
import { Closing } from './sections/closing'
import { Current } from './sections/current'
import { Free } from './sections/free'
import { Later } from './sections/later'
import { Product } from './sections/product/product'
import { SheetRule } from './sections/section'
import { TryIt } from './sections/try-it'

/** The public homepage at `/`. It reads no installation data, loads only same-origin files and sets no cookies. */
export function HomePage({ site = false }: { site?: boolean }) {
  return (
    <div className="vx-site">
      <SiteHeader signIn={!site} />
      <main id="main">
        <Hero site={site} />
        <SheetRule />
        <Current />
        <Free site={site} />
        <Later />
        <Product />
        <TryIt />
        <Closing site={site} />
      </main>
      <SiteFooter signIn={!site} />
    </div>
  )
}
