import { useState } from "react";
import { fetchJson } from "../../../app/api-client";
import { issueDetailSchema } from "./data";
import type { IssueEditTarget } from "./issue-keyboard-actions";

export function IssueKeyboardReview({ submitted, onUse }: {
  submitted: IssueEditTarget[];
  onUse: (rows: IssueEditTarget[]) => void;
}) {
  const [current, setCurrent] = useState<IssueEditTarget[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function review() {
    setBusy(true);
    setError("");
    try {
      const rows = await Promise.all(submitted.map((row) =>
        fetchJson(`/api/issues/${encodeURIComponent(row.identifier)}`, issueDetailSchema)));
      setCurrent(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the current issues.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="issue-keyboard-review" aria-label="Review conflicting issues">
      <p>Your submitted versions and choices are kept. Review the current issues before retrying.</p>
      <ul>{submitted.map((row) => <li key={row.identifier}>{row.identifier}: submitted version {row.version}</li>)}</ul>
      <button type="button" disabled={busy} onClick={() => void review()}>{busy ? "Loading current issues…" : "Review current issues"}</button>
      {current && <>
        <ul>{current.map((row) => <li key={row.identifier}>
          <strong>{row.identifier} · {row.title}</strong>
          <span>Current version {row.version} · {row.team.name} · {row.status.name} · {row.assignee?.name ?? "Unassigned"} · {row.priority}</span>
          <span>Labels: {row.labels.map((label) => label.name).join(", ") || "None"} · Estimate: {row.estimate ?? "None"} · Start: {row.startDate ?? "None"} · Due: {row.dueDate ?? "None"}</span>
          <span>Project: {row.project?.name ?? "None"} · Cycle: {row.cycle?.name ?? "None"}</span>
        </li>)}</ul>
        <button type="button" disabled={busy} onClick={() => onUse(current)}>Use reviewed versions</button>
      </>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
