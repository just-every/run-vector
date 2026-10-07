type OrbitArtProps = {
  variant: 'portal' | 'mail-unavailable'
}

export function OrbitArt({ variant }: OrbitArtProps) {
  const isUnavailable = variant === 'mail-unavailable'
  return (
    <div className={`orbit-art orbit-art--${variant}`} aria-hidden="true">
      <svg viewBox="0 0 620 720" focusable="false">
        <defs>
          <radialGradient id="orbitGlow" cx="50%" cy="52%" r="50%">
            <stop offset="0" stopColor="var(--color-accent)" stopOpacity=".8" />
            <stop offset=".32" stopColor="var(--color-accent)" stopOpacity=".17" />
            <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="orbitLine" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="var(--color-accent)" stopOpacity=".85" />
            <stop offset="1" stopColor="var(--color-accent)" stopOpacity=".1" />
          </linearGradient>
        </defs>
        <circle cx="304" cy="390" r="210" className="orbit-art__ring" />
        <circle cx="304" cy="390" r="146" className="orbit-art__ring orbit-art__ring--inner" />
        <circle cx="304" cy="390" r="154" fill="url(#orbitGlow)" />
        <path d="M304 90v300m0 0 270 180m-270-180L58 570" className="orbit-art__line" />
        <path d="M146 490 304 635 462 490V315H146z" className="orbit-art__envelope" />
        <rect x="190" y="246" width="228" height="232" rx="16" className="orbit-art__card" />
        {isUnavailable ? <>
          <circle cx="304" cy="360" r="55" className="orbit-art__symbol-ring" />
          <path d="m270 326 68 68m0-68-68 68" className="orbit-art__symbol" />
        </> : <>
          <path d="m248 366 40 40 76-90" className="orbit-art__symbol" />
          <circle cx="508" cy="565" r="40" className="orbit-art__satellite" />
          <path d="m492 564 30-13-14 30-5-12z" className="orbit-art__symbol orbit-art__symbol--small" />
        </>}
        <g className="orbit-art__dots">{Array.from({ length: 12 }, (_, index) => <circle key={index} cx={104 + (index % 4) * 18} cy={170 + Math.floor(index / 4) * 18} r="2.6" />)}</g>
      </svg>
    </div>
  )
}
