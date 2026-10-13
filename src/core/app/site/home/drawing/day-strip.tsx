import { Leader } from './tag'

/**
 * Seven equal day cells, drawn as a calendar strip: the day work was deferred (an ink dot), the days it is away from
 * Needs decision (hatched) and the chosen return day (cobalt, with its time on a leader). A cobalt arc leaves the first
 * day and lands on the return day. The cells carry the day numbers as real text.
 */
export function DayStrip({ days, time }: { days: readonly number[]; time: string }) {
  const last = days.length - 1
  return (
    <div className="vx-days">
      <svg className="vx-days-arc" viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0 52C0 -17 100 -17 100 44" vectorEffect="non-scaling-stroke" />
      </svg>
      <svg className="vx-days-head" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M0 0H12L6 12Z" /></svg>
      <ol className="vx-days-cells">
        {days.map((day, i) => (
          <li key={day} className={i === 0 ? 'vx-day vx-day--from' : i === last ? 'vx-day vx-day--back' : 'vx-day vx-day--away'}>
            <span className="vx-day-n">{day}</span>
          </li>
        ))}
      </ol>
      <div className="vx-days-time">
        <Leader dir="v" end="none" />
        <span>{time}</span>
      </div>
    </div>
  )
}
