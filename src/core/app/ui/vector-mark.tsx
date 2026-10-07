type VectorMarkProps = {
  label?: string
  compact?: boolean
}

export function VectorMark({ label = 'Vector', compact = false }: VectorMarkProps) {
  return (
    <span className="vector-mark" aria-label={label}>
      <svg aria-hidden="true" viewBox="0 0 30 28" focusable="false">
        <path d="M1 2h12L8.2 13.6z" />
        <path d="M17 2h12L12.3 26z" />
      </svg>
      {compact ? null : <span>{label}</span>}
    </span>
  )
}
