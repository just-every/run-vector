import { useState } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import { useDateFormat } from "../../../shared/date-format";
import { issueDetailSchema, type IssueDetailData } from "./data";
import {
  issueFieldPayload,
  type EditableIssueField,
} from "./issue-field-value";
import "./issue-editor.css";

const fieldLabels = {
  estimate: "Estimate",
  startDate: "Start date",
  dueDate: "Due date",
  expectedOutcome: "Expected outcome",
  customerImpact: "Customer impact",
};

export function IssueFieldEditor({
  issue,
  field,
  onRefresh,
  writable = true,
}: {
  writable?: boolean;
  issue: IssueDetailData;
  field: EditableIssueField;
  onRefresh: (receipt?: IssueDetailData) => void;
}) {
  // `original` is the field's value when editing began: a newer version that
  // left this field alone (often the operator's own property change) is not a conflict.
  const { date } = useDateFormat();
  const [snapshot, setSnapshot] = useState<{
    version: number;
    original: string;
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
  const stale =
    snapshot !== null &&
    current.version > snapshot.version &&
    String(current[field] ?? "") !== snapshot.original;
  const value = current[field];
  const displayed =
    value === null
      ? "Not set"
      : field === "estimate"
        ? `${value} points`
        : field === "dueDate" || field === "startDate"
          ? date(String(value))
          : value;

  function open() {
    const original = String(current[field] ?? "");
    setSnapshot({ version: current.version, original, draft: original });
    setConflict(false);
    setError("");
  }
  async function save(draft: string) {
    if (!snapshot || pending || stale || conflict) return;
    setSnapshot({ ...snapshot, draft });
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
            issueFieldPayload(
              Math.max(snapshot.version, current.version),
              field,
              draft,
            ),
          ),
        },
      );
      setReceipt(updated);
      setSnapshot(null);
      onRefresh(updated);
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
      const original = String(updated[field] ?? "");
      setSnapshot({ version: updated.version, original, draft: original });
      setConflict(false);
      setError("");
      onRefresh(updated);
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
          disabled={!writable || pending}
          onClick={() => (snapshot ? setSnapshot(null) : open())}
        >
          Edit
        </button>
      </div>
      {writable && snapshot ? (
        <form
          className="issue-mutation-form"
          aria-label={`Edit ${name}`}
          onSubmit={(event) => {
            event.preventDefault();
            void save(snapshot.draft);
          }}
        >
          <fieldset disabled={!writable || pending} className="issue-editor-controls">
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
              <button type="submit" disabled={!writable || pending || stale || conflict}>
                {pending ? "Saving…" : `Save ${name}`}
              </button>
              <button type="button" onClick={() => setSnapshot(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!writable || field === "estimate" && (pending || stale || conflict)}
                onClick={() =>
                  field === "estimate"
                    ? void save("")
                    : setSnapshot({ ...snapshot, draft: "" })
                }
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
