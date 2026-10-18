import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { fetchJson, useApiResource } from "../../app/api-client";
import { workloadSchema, type Workload } from "./schema";
import "./workload.css";

export function WorkloadPanel({ cycleId }: { cycleId: string }) {
  const [query, setQuery] = useState("cycleId=" + encodeURIComponent(cycleId));
  const [mode, setMode] = useState("cycle");
  const resource = useApiResource("/api/workload?" + query, workloadSchema);
  const data = resource.data;
  return (
    <section className="workload" aria-labelledby="workload-heading">
      <h2 id="workload-heading">Workload</h2>
      <p>
        Assigned scope and each person's stated capacity, in points. Canceled
        and duplicate issues are excluded; unestimated work keeps capacity
        uncertain. This is planning scope, not a measure of output.
      </p>
      <label>
        Workload period
        <select
          aria-label="Workload period"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            if (e.target.value === "cycle")
              setQuery("cycleId=" + encodeURIComponent(cycleId));
          }}
        >
          <option value="cycle">This cycle</option>
          <option value="dates">Due-date range</option>
        </select>
      </label>
      {mode === "dates" && (
        <form
          className="workload-range"
          aria-label="Workload due-date range"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setQuery(
              new URLSearchParams({
                from: String(data.get("from")),
                to: String(data.get("to")),
              }).toString(),
            );
          }}
        >
          <label>
            Due from
            <input type="date" name="from" required />
          </label>
          <label>
            Due through
            <input type="date" name="to" required />
          </label>
          <button>Show workload</button>
        </form>
      )}
      {resource.error && (
        <p role="alert">
          {resource.error.message}{" "}
          <button onClick={resource.reload}>Reload workload</button>
        </p>
      )}
      {!data && !resource.error && <p role="status">Loading workload…</p>}
      {data && (
        <>
          <p>
            Scope: {data.title} · Calendar dates in {data.timezone}. Date ranges
            include due dates at both ends; issues with no due date are
            excluded.
          </p>
          <div className="workload-people">
            {data.rows.map((row) => (
              <WorkloadPerson
                key={row.operatorId ?? "unassigned"}
                row={row}
                mine={row.operatorId === data.operatorId}
                query={query}
                scope={data.scope}
                reload={resource.reload}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function WorkloadPerson({
  row,
  mine,
  query,
  scope,
  reload,
}: {
  row: Workload["rows"][number];
  mine: boolean;
  query: string;
  scope: string;
  reload: () => void;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  return (
    <article
      className="admin-record workload-person"
      aria-label={"Workload for " + row.name}
    >
      <h3>
        {row.name}
        {mine ? " (you)" : ""}
      </h3>
      <p>
        {row.issueCount} {row.issueCount === 1 ? "issue" : "issues"} ·{" "}
        {row.points} estimated points
        {row.unestimated > 0 ? ` · ${row.unestimated} unestimated` : ""}
      </p>
      <p>
        {row.capacity === null
          ? "Capacity not stated"
          : `Capacity: ${row.capacity} points`}{" "}
        ·{" "}
        <strong>
          {row.state === "over-capacity"
            ? "Over capacity"
            : row.state === "within-capacity"
              ? "Within capacity"
              : "Capacity unknown"}
        </strong>
      </p>
      {mine && (
        <form
          key={scope + ":" + row.version}
          aria-label="Set my workload capacity"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            const value = String(
              new FormData(e.currentTarget).get("capacity"),
            ).trim();
            setPending(true);
            setError("");
            setMessage("");
            try {
              await fetchJson("/api/workload?" + query, workloadSchema, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  capacity: value === "" ? null : Number(value),
                  expectedVersion: row.version,
                }),
              });
              setMessage("Your capacity is saved.");
              reload();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Capacity could not be saved.",
              );
              reload();
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            My capacity in points
            <input
              name="capacity"
              type="number"
              min="0"
              max="100000"
              step="1"
              defaultValue={row.capacity ?? ""}
            />
          </label>
          <button disabled={pending}>
            {pending ? "Saving…" : "Save my capacity"}
          </button>
          <small>
            Leave empty for unknown; zero means no capacity for this period.
          </small>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {row.issues.length > 0 && (
        <details>
          <summary>Assigned issues ({row.issueCount})</summary>
          <ul>
            {row.issues.map((issue) => (
              <li key={issue.identifier}>
                <Link
                  to="/app/issues/$identifier"
                  params={{ identifier: issue.identifier }}
                >
                  {issue.identifier} · {issue.title}
                </Link>{" "}
                ·{" "}
                {issue.estimate === null
                  ? "Unestimated"
                  : `${issue.estimate} points`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
