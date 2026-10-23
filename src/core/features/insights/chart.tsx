import type {InsightReport} from "./schema";
const number = (n: number | null) => n === null ? "—" : new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(n);
export function InsightChart({ report, select }: { report: InsightReport; select: (key: string) => void }) {
  const max = Math.max(1, ...report.rows.map(r => report.duration ? r.median ?? 0 : r.value));
  return <div className="insights-bars" aria-label="Weekly chart">
    {report.rows.map(row => {
      const value = report.duration ? row.median ?? 0 : row.value;
      return <button key={row.key} className="insights-bar" onClick={() => select(row.key)}
        aria-label={`${row.week}, ${row.group}, ${row.series.split(" · ")[0]}: ${number(value)}${report.duration ? " days" : ""}. View ${row.count} issues.`}>
        <span>{row.week} · {row.group} · {row.series.split(" · ")[0]}</span>
        <svg viewBox="0 0 400 24" aria-hidden="true" focusable="false">
          <rect x="1" y="4" width={Math.max(1, 395 * value / max)} height="16" className={row.series === "Completed" ? "insights-mark-outline" : "insights-mark"} />
        </svg><strong>{number(value)}</strong>
      </button>;
    })}
  </div>;
}
