/** Vector's mark: the letter V drawn as a vector. A cobalt origin point at top-left, one ink stroke dropping to the vertex and climbing out to an open arrowhead. */
export function BrandMark({ className = 'vx-brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0.2 2.2 20.82 18.75" aria-hidden="true" focusable="false">
      <circle cx="3.6" cy="5.6" r="3.4" fill="var(--vx-cobalt, #2446dc)" />
      <path d="M6.06 11.13L9.8 19.55L18.2 3.6M12.42 5.84L18.2 3.6L19.62 9.64" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
