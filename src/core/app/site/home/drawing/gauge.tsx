const R = 110
const CX = 120
const CY = 122

/** The point on the semicircle at `percent` of the way from the left end (0) to the right end (100). */
function at(percent: number, radius: number) {
  const a = Math.PI * (1 - percent / 100)
  return { x: CX + radius * Math.cos(a), y: CY - radius * Math.sin(a) }
}

const f = (n: number) => n.toFixed(2)

/**
 * A protractor: a semicircle with a tick every 10%, the finished part inked heavier and a cobalt "now" dot where it
 * ends. It stands on the paper with no card; the cycle's name and points are DOM text beside it.
 */
export function Gauge({ percent }: { percent: number }) {
  const ticks = Array.from({ length: 11 }, (_, i) => i * 10)
  const end = at(percent, R)
  return (
    <svg className="vx-gauge" viewBox="0 0 240 132" aria-hidden="true" focusable="false">
      <path className="vx-gauge-outer" d={`M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}`} />
      <path className="vx-gauge-base" d={`M${CX - R} ${CY}H${CX + R}M${CX} ${CY - 6}V${CY + 6}`} />
      <path className="vx-gauge-ticks" d={ticks.map((t) => {
        const long = t % 50 === 0
        const a = at(t, R)
        const b = at(t, R - (long ? 12 : 6))
        return `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`
      }).join('')} />
      <path className="vx-gauge-done" d={`M${CX - R} ${CY}A${R} ${R} 0 0 1 ${f(end.x)} ${f(end.y)}`} />
      <circle className="vx-gauge-now" cx={f(end.x)} cy={f(end.y)} r="6" />
    </svg>
  )
}
