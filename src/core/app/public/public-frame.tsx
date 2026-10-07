import type { ReactNode } from 'react'
import { productConfig } from '../config'
import { VectorMark } from '../ui/vector-mark'
import { OrbitArt } from './orbit-art'

type PublicFrameProps = {
  children: ReactNode
  variant: 'portal' | 'mail-unavailable'
}

export function PublicFrame({ children, variant }: PublicFrameProps) {
  return (
    <main className="public-page">
      <header className="public-header">
        <VectorMark label={productConfig.productName} />
      </header>
      <div className="public-layout">
        <section className="public-copy">{children}</section>
        <OrbitArt variant={variant} />
      </div>
      {productConfig.showPoweredByCredit ? (
        <footer className="public-footer">
          Powered by <span>{productConfig.productName}</span> · <a href="https://runeditrun.com">runeditrun.com</a>
        </footer>
      ) : null}
    </main>
  )
}
