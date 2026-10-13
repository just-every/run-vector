import { useState, type FormEvent } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import { shortDate } from "../../streams/ui/helpers";
import { issueDetailSchema, type IssueDetailData } from "./data";
import {
  issueFieldPayload,
  type EditableIssueField,
} from "./issue-field-value";
import "./issue-editor.css";

const fieldLabels = {
  estimate: "Estimate",
  dueDate: "Due date",
  expectedOutcome: "Expected outcome",
  customerImpact: "Customer impact",
};

export function IssueFieldEditor({
  issue,
  field,
  onRefresh,
}: {
  issue: IssueDetailData;
  field: EditableIssueField;
  onRefresh: () => void;
}) {
  const [snapshot, setSnapshot] = useState<{
    version: number;
    draft: string;
  } | null>(null);
  const [receipt, setReceipt] = useState<IssueDetailData | null>(null);
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const current = receipt && receipt.version > issue.version ? receipt : issue;
  const label = fieldLabels[field];
  const name = label.toLowerCase();
  const multiline = field === "expectedOutcome" || field === "customerImpact";
  const stale = snapshot !== null && current.version > snapshot.version;
  const value = current[field];
  const displayed =
    value === null
      ? "Not set"
      : field === "estimate"
        ? `${value} points`
        : field === "dueDate"
          ? shortDate(String(value))
          : value;

  function open() {
    setSnapshot({
      version: current.version,
      draft: String(current[field] ?? ""),
    });
    setConflict(false);
    setError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!snapshot || pending || stale || conflict) return;
    setPending(true);
    setError("");
    try {
      const updated = await fetchJson(
        `/api/issues/${issue.identifier}`,
        issueDetailSchema,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            issueFieldPayload(snapshot.version, field, snapshot.draft),
          ),
        },
      );
      setReceipt(updated);
      setSnapshot(null);
      onRefresh();
    } catch (cause) {
      const staleVersion = cause instanceof ApiError && cause.status === 409;
      setConflict(staleVersion);
      setError(
        staleVersion
          ? `This issue changed. Your draft is kept. Reload ${name} before saving again.`
          : cause instanceof Error
            ? cause.message
            : "The change could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }
  async function reload() {
    if (pending) return;
    setPending(true);
    try {
      const updated = await fetchJson(
        `/api/issues/${issue.identifier}`,
        issueDetailSchema,
      );
      // A failed reload leaves both the draft and its version untouched.
      setReceipt(updated);
      setSnapshot({
        version: updated.version,
        draft: String(updated[field] ?? ""),
      });
      setConflict(false);
      setError("");
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reload failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div
      className={`issue-field-editor${multiline ? " issue-field-editor--text" : ""}`}
    >
      <div className="issue-field-heading">
        {multiline ? (
          <h2>{label}</h2>
        ) : (
          <span>
            {label}: {displayed}
          </span>
        )}
        <button
          type="button"
          aria-label={`Edit ${name}`}
          aria-expanded={snapshot !== null}
          disabled={pending}
          onClick={() => (snapshot ? setSnapshot(null) : open())}
        >
          Edit
        </button>
      </div>
      {snapshot ? (
        <form
          className="issue-mutation-form"
          aria-label={`Edit ${name}`}
          onSubmit={save}
        >
          <fieldset disabled={pending} className="issue-editor-controls">
            <label>
              {label}
              {multiline ? (
                <textarea
                  aria-label={`Issue ${name}`}
                  name={field}
                  maxLength={20000}
                  value={snapshot.draft}
                  onChange={(event) =>
                    setSnapshot({ ...snapshot, draft: event.target.value })
                  }
                />
              ) : (
                <input
                  aria-label={`Issue ${name}`}
                  name={field}
                  type={field === "estimate" ? "number" : "date"}
                  min={field === "estimate" ? 1 : undefined}
                  max={field === "estimate" ? 100 : undefined}
                  step={field === "estimate" ? 1 : undefined}
                  value={snapshot.draft}
                  onChange={(event) =>
                    setSnapshot({ ...snapshot, draft: event.target.value })
                  }
                />
              )}
            </label>
            <div className="issue-editor-actions">
              <button type="submit" disabled={pending || stale || conflict}>
                {pending ? "Saving…" : `Save ${name}`}
              </button>
              <button type="button" onClick={() => setSnapshot(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setSnapshot({ ...snapshot, draft: "" })}
              >
                Clear {name}
              </button>
            </div>
            {error || stale ? (
              <p role="alert">
                {error ||
                  "This issue changed. Your draft is kept. Reload before saving."}{" "}
                <button type="button" onClick={() => void reload()}>
                  Reload {name}
                </button>
              </p>
            ) : null}
          </fieldset>
        </form>
      ) : multiline ? (
        <p>{displayed}</p>
      ) : null}
    </div>
  );
}
