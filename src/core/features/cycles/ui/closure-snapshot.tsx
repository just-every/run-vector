import type { CycleSnapshot } from "../../cycle-closure/schema";
import "./closure-snapshot.css";
export function ClosureSnapshot({ snapshot }: { snapshot: CycleSnapshot }) {
  return (
    <section className="closure-snapshot" aria-label="Frozen cycle snapshot">
      <h2>Snapshot at close</h2>
      <p>
        Closed{" "}
        {new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: snapshot.timezone,
        }).format(new Date(snapshot.closedAt))}{" "}
        · {snapshot.timezone}
      </p>
      <p>
        {snapshot.committed.length} committed · {snapshot.completed.length}{" "}
        completed · {snapshot.estimateTotal} recorded estimate points ·{" "}
        {snapshot.completedEstimateTotal} completed estimate points
      </p>
      <p>
        {snapshot.progress.percentage === null
          ? "No committed work."
          : `${snapshot.progress.completed} / ${snapshot.progress.total} ${snapshot.progress.unit === "points" ? "points" : "by issue count"} completed · ${snapshot.progress.percentage}%`}
      </p>
      <p>
        {snapshot.capacity === null
          ? "No capacity set."
          : `Capacity: ${snapshot.capacity} points.`}{" "}
        {snapshot.progress.remainingPoints === null
          ? `${snapshot.progress.unestimatedRemaining} remaining issues have no estimate.`
          : `${snapshot.progress.remainingPoints} remaining points.`}
      </p>
      <p>
        These facts are frozen at closure. Later issue edits and deletion
        preserve this history.
      </p>
      <div
        className="closure-snapshot__table"
        role="region"
        aria-label="Committed scope at close"
        tabIndex={0}
      >
        <table>
          <caption>Committed scope at close</caption>
          <thead>
            <tr>
              <th>Identifier</th>
              <th>Status</th>
              <th>Estimate</th>
              <th>Project at close</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.committed.map((issue) => (
              <tr key={issue.identifier}>
                <th scope="row">{issue.identifier}</th>
                <td>{issue.category}</td>
                <td>
                  {issue.estimate === null
                    ? "Unestimated"
                    : `${issue.estimate} points`}
                </td>
                <td>
                  {issue.projectId === null
                    ? "No project"
                    : issue.projectName ?? "Project name was not recorded"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!snapshot.committed.length && <p>No committed work.</p>}
      <h3>Scope changes during the cycle</h3>
      {snapshot.changes.length ? (
        <ul>
          {snapshot.changes.map((change, index) => (
            <li key={index}>
              {change.identifier} · {change.direction} ·{" "}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: snapshot.timezone,
              }).format(new Date(change.at))}
            </li>
          ))}
        </ul>
      ) : (
        <p>No additions or removals recorded during this interval.</p>
      )}
    </section>
  );
}
