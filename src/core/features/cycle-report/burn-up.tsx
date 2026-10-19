import type { CycleReport } from "./schema";

export function BurnUp({ report }: { report: CycleReport }) {
  const { days } = report;
  const width = 720, height = 260, left = 42, right = 18, top = 18, bottom = 70;
  const max = Math.max(1, ...days.flatMap(d => [d.scope ?? 0, d.completed ?? 0]));
  const x = (index: number) => left + index * (width - left - right) / Math.max(1, days.length - 1);
  const y = (value: number) => height - bottom - value / max * (height - top - bottom);
  const path = (field: "scope" | "completed") => {
    let connected = false;
    return days.map((day, index) => {
      const value = day[field];
      if (value === null) { connected = false; return ""; }
      const segment = `${connected ? "L" : "M"}${x(index)},${y(value)}`;
      connected = true;
      return segment;
    }).join(" ");
  };
  if (!days.length) return <p>The burn-up begins on the cycle’s first day.</p>;
  return <>
    <div className="cycle-report__legend"><span className="cycle-report__scope-key">Scope</span><span className="cycle-report__completed-key">Completed</span><span>+ Added · − Removed</span></div>
    <svg className="cycle-report__chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cycle burn-up of issue scope and completion by day">
      <title>Cycle burn-up</title>
      <desc>Daily issue counts. Scope and completed work exclude Canceled and Duplicate. Additions and removals are marked along the day axis. The daily data table provides all values.</desc>
      {[0, max / 2, max].map(value => <g key={value}>
        <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="cycle-report__grid" />
        <text x={left - 8} y={y(value) + 4} textAnchor="end">{Number.isInteger(value) ? value : value.toFixed(1)}</text>
      </g>)}
      <path d={path("scope")} className="cycle-report__scope" />
      <path d={path("completed")} className="cycle-report__completed" />
      {days.map((day, index) => <g key={day.date}>
        {day.scope !== null && <circle cx={x(index)} cy={y(day.scope)} r={3} className="cycle-report__scope-dot"><title>{day.date}: {day.scope} issues in scope</title></circle>}
        {day.completed !== null && <circle cx={x(index)} cy={y(day.completed)} r={3} className="cycle-report__completed-dot"><title>{day.date}: {day.completed} completed</title></circle>}
        {(day.added.length > 0 || day.removed.length > 0) && <text x={x(index)} y={height - 33} textAnchor="middle" className="cycle-report__marker"><title>{day.date}: added {day.added.join(", ") || "none"}; removed {day.removed.join(", ") || "none"}</title>{day.added.length ? `+${day.added.length}` : ""}{day.added.length && day.removed.length ? " / " : ""}{day.removed.length ? `−${day.removed.length}` : ""}</text>}
      </g>)}
      <text x={left} y={height - 3}>{days[0].date}</text>
      {days.length > 1 && <text x={width - right} y={height - 3} textAnchor="end">{days.at(-1)!.date}</text>}
    </svg>
    <details className="cycle-report__daily">
      <summary>Daily data and scope changes</summary>
      <div className="cycle-report__table" role="region" aria-label="Daily burn-up data" tabIndex={0}>
        <table><caption>Daily burn-up · issues · {report.timezone}</caption>
          <thead><tr><th>Day</th><th>Scope</th><th>Completed</th><th>Added</th><th>Removed</th></tr></thead>
          <tbody>{days.map(day => <tr key={day.date}><th scope="row">{day.date}</th><td>{day.scope ?? "Not recorded"}</td><td>{day.completed ?? "Not recorded"}</td><td>{day.added.join(", ") || "—"}</td><td>{day.removed.join(", ") || "—"}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </>;
}
