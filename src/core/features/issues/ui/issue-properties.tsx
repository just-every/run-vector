import { canSelectCycle } from "../../cycles/ui/commitment-choices";
import { useState } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import type { StreamOptions } from "../../streams/ui/data";
import { issueDetailSchema, type IssueDetailData } from "./data";

export function IssueProperties({
  issue: suppliedIssue,
  options,
  onRefresh,
}: {
  issue: IssueDetailData;
  options: StreamOptions | null;
  onRefresh: (receipt?: IssueDetailData) => void;
}) {
  const [receipt, setReceipt] = useState<IssueDetailData | null>(null);
  const issue =
    receipt?.identifier === suppliedIssue.identifier &&
    receipt.version > suppliedIssue.version
      ? receipt
      : suppliedIssue;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  async function change(field: string, value: string) {
    if (busy || conflict) return;
    setBusy(true);
    setError("");
    try {
      const updated = await fetchJson(
        `/api/issues/${issue.identifier}`,
        issueDetailSchema,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedVersion: issue.version,
            [field]: value || null,
          }),
        },
      );
      setReceipt(updated);
      onRefresh(updated);
    } catch (e) {
      const stale = e instanceof ApiError && e.status === 409;
      setConflict(stale);
      setError(
        stale
          ? "This issue changed elsewhere. Reload the current values before choosing again."
          : e instanceof Error
            ? e.message
            : "The change could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setBusy(true);
    try {
      const updated = await fetchJson(
        `/api/issues/${issue.identifier}`,
        issueDetailSchema,
      );
      setReceipt(updated);
      setConflict(false);
      setError("");
      onRefresh(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reload failed.");
    } finally {
      setBusy(false);
    }
  }
  const statuses =
    options?.statuses.filter(
      (s) =>
        s.teamId === issue.team.id &&
        !["intake", "duplicate"].includes(s.category),
    ) ?? [];
  const cycles =
    options?.cycles.filter((c) => c.teamId === issue.team.id) ?? [];
  function picker(
    label: string,
    field: string,
    value: string,
    choices: Array<{ id: string; name: string }>,
    empty?: string,
    disabled = false,
  ) {
    const currentName =
      field === "statusId"
        ? issue.status.name
        : field === "assigneeOperatorId"
          ? issue.assignee?.name
          : field === "projectId"
            ? issue.project?.name
            : field === "cycleId"
              ? issue.cycle?.name
              : value;
    return (
      <label
        key={field}
        className={
          field === "projectId" || field === "cycleId"
            ? "issue-property-wide"
            : undefined
        }
      >
        <span className="issue-property-name">{label}</span>
        <select
          aria-label={`Issue ${label.toLowerCase()}`}
          value={value}
          disabled={busy || conflict || !options || disabled}
          onChange={(e) => void change(field, e.target.value)}
        >
          {empty ? <option value="">{empty}</option> : null}
          {value && !choices.some((c) => c.id === value) ? (
            <option value={value}>
              {currentName}
              {disabled ? "" : " (unavailable)"}
            </option>
          ) : null}
          {choices.map((c) => (
            <option
              key={c.id}
              value={c.id}
              disabled={
                field === "cycleId" &&
                !canSelectCycle(
                  issue.status.category,
                  issue.cycle?.id ?? null,
                  c.id,
                )
              }
            >
              {c.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <section className="issue-property-bar" aria-label="Issue properties">
      {picker(
        "Status",
        "statusId",
        issue.status.id,
        statuses,
        undefined,
        ["intake", "duplicate"].includes(issue.status.category),
      )}
      {picker("Priority", "priority", issue.priority, [
        { id: "none", name: "No priority" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
        { id: "urgent", name: "Urgent" },
      ])}
      {picker(
        "Assignee",
        "assigneeOperatorId",
        issue.assignee?.id ?? "",
        options?.operators ?? [],
        "Unassigned",
      )}
      {picker(
        "Project",
        "projectId",
        issue.project?.id ?? "",
        options?.projects ?? [],
        "No project",
      )}
      {picker("Cycle", "cycleId", issue.cycle?.id ?? "", cycles, "No cycle")}
      {error ? (
        <p role="alert">
          {error}{" "}
          {conflict ? (
            <button type="button" disabled={busy} onClick={() => void reload()}>
              Reload properties
            </button>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
