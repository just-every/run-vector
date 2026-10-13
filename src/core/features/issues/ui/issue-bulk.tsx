import { useState } from "react";
import { z } from "zod";
import { ApiError, fetchJson } from "../../../app/api-client";
import type { WorkspaceOptions } from "../../../shared/workspace-options";
import type { IssueRow } from "./issue-selection";

const receiptSchema = z.object({
  issues: z.array(z.object({ identifier: z.string(), version: z.number() })),
  changed: z.number(),
});
const failuresSchema = z.object({
  failures: z.array(
    z.object({ identifier: z.string(), reasons: z.array(z.string()) }),
  ),
});
export function IssueBulk({
  selection,
  options,
  onRefresh,
  onClear,
  onRemove,
  onSuccess,
}: {
  selection: Map<string, IssueRow>;
  options: WorkspaceOptions | null;
  onRefresh: () => void;
  onClear: () => void;
  onRemove: (identifier: string) => void;
  onSuccess: (issues: Array<{ identifier: string; version: number }>) => void;
}) {
  const [field, setField] = useState("priority"),
    [value, setValue] = useState(""),
    [labels, setLabels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [failures, setFailures] = useState<
    Array<{ identifier: string; reasons: string[] }>
  >([]);
  const rows = [...selection.values()];
  const teamIds = new Set(rows.map((row) => row.team.id));
  const choices =
    field === "statusId"
      ? (options?.statuses.filter((s) => teamIds.has(s.teamId)) ?? [])
      : field === "assigneeOperatorId"
        ? (options?.operators ?? [])
        : field === "projectId"
          ? (options?.projects ?? [])
          : field === "cycleId"
            ? (options?.cycles.filter((c) => teamIds.has(c.teamId)) ?? [])
            : ["urgent", "high", "medium", "low", "none"].map((id) => ({
                id,
                name: id === "none" ? "No priority" : id,
              }));
  async function apply() {
    if (
      busy ||
      !rows.length ||
      !options ||
      rows.length > options.bulkEditIssuesPerOperation
    )
      return;
    setBusy(true);
    setMessage("");
    setFailures([]);
    const changes =
      field === "labelIds" ? { labelIds: labels } : { [field]: value || null };
    try {
      const receipt = await fetchJson("/api/issues/bulk", receiptSchema, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          issues: rows.map((r) => ({
            identifier: r.identifier,
            expectedVersion: r.version,
          })),
          changes,
        }),
      });
      setMessage(
        `${receipt.changed} issues updated: ${field === "labelIds" ? "labels" : field === "statusId" ? "status" : field === "assigneeOperatorId" ? "assignee" : field === "projectId" ? "project" : field === "cycleId" ? "cycle" : "priority"} ${field === "labelIds" ? (labels.length ? labels.map((id) => options?.labels.find((l) => l.id === id)?.name ?? id).join(", ") : "cleared") : (choices.find((c) => c.id === value)?.name ?? "cleared")}.`,
      );
      onSuccess(receipt.issues);
      onRefresh();
    } catch (error) {
      const failed =
        error instanceof ApiError ? failuresSchema.safeParse(error.body) : null;
      if (failed?.success) setFailures(failed.data.failures);
      setMessage(error instanceof Error ? error.message : "Bulk edit failed.");
      onRefresh();
    } finally {
      setBusy(false);
    }
  }
  if (!rows.length) return null;
  return (
    <section className="issues-bulk" aria-label="Bulk edit">
      <strong>{rows.length} selected</strong>
      <button onClick={onClear} disabled={busy}>
        Clear selection
      </button>
      <details className="bulk-selection">
        <summary>Selected issues</summary>
        <ul>
          {rows.map((row) => (
            <li key={row.identifier}>
              {row.identifier}{" "}
              <button
                disabled={busy}
                onClick={() => onRemove(row.identifier)}
                aria-label={`Remove ${row.identifier} from selection`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </details>
      <label>
        Change
        <select
          aria-label="Change"
          value={field}
          disabled={busy}
          onChange={(e) => {
            setField(e.target.value);
            setValue("");
          }}
        >
          {[
            ["statusId", "Status"],
            ["assigneeOperatorId", "Assignee"],
            ["priority", "Priority"],
            ["projectId", "Project"],
            ["cycleId", "Cycle"],
            ["labelIds", "Labels"],
          ].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {field === "labelIds" ? (
        <fieldset>
          <legend>Replace labels</legend>
          {options?.labels.map((l) => (
            <label key={l.id}>
              <input
                type="checkbox"
                checked={labels.includes(l.id)}
                disabled={busy}
                onChange={(e) =>
                  setLabels(
                    e.target.checked
                      ? [...labels, l.id]
                      : labels.filter((id) => id !== l.id),
                  )
                }
              />
              {l.name}
            </label>
          ))}
          <small>No labels selected clears labels.</small>
        </fieldset>
      ) : (
        <label>
          Set to
          <select
            aria-label="Set to"
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">
              {["assigneeOperatorId", "projectId", "cycleId"].includes(field)
                ? "None"
                : "Choose value"}
            </option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        disabled={
          busy ||
          !options ||
          rows.length > options.bulkEditIssuesPerOperation ||
          (["statusId", "priority"].includes(field) && !value)
        }
        onClick={() => void apply()}
      >
        {busy ? "Applying…" : "Apply to selected"}
      </button>
      {options && rows.length > options.bulkEditIssuesPerOperation && (
        <p role="alert">
          Select at most {options?.bulkEditIssuesPerOperation} issues.
        </p>
      )}
      {message && <p role={failures.length ? "alert" : "status"}>{message}</p>}
      {failures.length > 0 && (
        <>
          <p>Nothing was changed.</p>
          <ul>
            {failures.map((f) => (
              <li key={f.identifier}>
                <strong>{f.identifier}</strong>: {f.reasons.join("; ")}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
