import { BrandMark } from '../site/shell/brand-mark'

type VectorMarkProps = {
  label?: string
  compact?: boolean
}

/** The app's lockup: the brand mark (docs/BRAND.md) and the installation's product name. */
export function VectorMark({ label = 'Vector', compact = false }: VectorMarkProps) {
  return (
    <span className="vector-mark" aria-label={label}>
      <BrandMark className="vector-mark-symbol" />
      {compact ? null : <span>{label}</span>}
    </span>
  )
}
