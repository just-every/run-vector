import { useEffect, useState } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import type { WorkspaceOptions } from "../../../shared/workspace-options";
import { issueFieldPayload } from "./issue-field-value";
import { issueDetailSchema } from "./data";
import { bulkFailuresSchema, bulkReceiptSchema, initialIssueEditValue, issueEditChoices,
  issueEditFields, type BulkReceipt, type IssueEditField, type IssueEditTarget } from "./issue-keyboard-actions";
import { IssueKeyboardModal } from "./issue-keyboard-modal";
import { IssueKeyboardFields } from "./issue-keyboard-fields";
import { IssueKeyboardReview } from "./issue-keyboard-review";

export function IssueKeyboardDialog({ field, targets, options, onClose, onSuccess }: {
  field: IssueEditField;
  targets: IssueEditTarget[];
  options: WorkspaceOptions | null;
  onClose: () => void;
  onSuccess: (receipt: BulkReceipt) => void;
}) {
  // The dialog owns its version snapshot. List polls must never replace it.
  const [rows, setRows] = useState(() => targets.map((row) => structuredClone(row)));
  const [value, setValue] = useState(() => initialIssueEditValue(field, targets));
  const [labels, setLabels] = useState(() => targets[0]?.labels
    .filter((label) => targets.every((row) => row.labels.some((other) => other.id === label.id)))
    .map((label) => label.id) ?? []);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const [failures, setFailures] = useState<Array<{ identifier: string; reasons: string[] }>>([]);
  const [estimatesReady, setEstimatesReady] = useState(field !== "estimate" || targets.every((row) => row.estimate !== undefined));
  useEffect(() => {
    // Estimate is absent from list projections. Read it before the user edits,
    // so an existing estimate is never represented as an empty draft.
    if (field !== "estimate" || targets.every((row) => row.estimate !== undefined)) return;
    let active = true;
    void Promise.all(targets.map((row) => fetchJson(`/api/issues/${encodeURIComponent(row.identifier)}`, issueDetailSchema)))
      .then((current) => {
        if (!active) return;
        setRows(current.map((row) => ({ ...row, version: targets.find((target) => target.identifier === row.identifier)!.version })));
        setValue(initialIssueEditValue(field, current));
        setEstimatesReady(true);
      }).catch((cause: unknown) => {
        if (active) setMessage(`Could not load estimates. Close and retry. ${cause instanceof Error ? cause.message : ""}`);
      });
    return () => { active = false; };
  }, [field, targets]);
  const choices = options ? issueEditChoices(field, rows, options) : [];
  const unavailable = ["statusId", "priority"].includes(field)
    ? !choices.some((choice) => choice.id === value)
    : ["assigneeOperatorId", "projectId", "milestoneId", "cycleId"].includes(field) && !!value && !choices.some((choice) => choice.id === value);
  const overLimit = !!options && rows.length > options.bulkEditIssuesPerOperation;
  const tooManyLabels = !!options && field === "labelIds" && labels.length > options.labelsPerIssue;
  async function apply() {
    if (busy || conflict || !estimatesReady || !options || !rows.length || unavailable || overLimit || tooManyLabels) return;
    setMessage("");
    setFailures([]);
    let changes;
    try {
      if (field === "labelIds") changes = { labelIds: labels };
      else if (field === "estimate" || field === "dueDate" || field === "startDate") {
        const { expectedVersion: _version, ...change } = issueFieldPayload(rows[0]!.version, field, value);
        changes = change;
      } else changes = { [field]: value || null };
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Choose a valid value.");
      return;
    }
    setBusy(true);
    try {
      const receipt = await fetchJson("/api/issues/bulk", bulkReceiptSchema, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          issues: rows.map((row) => ({ identifier: row.identifier, expectedVersion: row.version })), changes,
        }),
      });
      onSuccess(receipt);
    } catch (cause) {
      const parsed = cause instanceof ApiError ? bulkFailuresSchema.safeParse(cause.body) : null;
      if (parsed?.success) setFailures(parsed.data.failures);
      setConflict(cause instanceof ApiError && cause.status === 409);
      setMessage(cause instanceof Error ? cause.message : "The issues could not be updated.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <IssueKeyboardModal title={`Change ${issueEditFields[field].toLowerCase()}`} busy={busy} onClose={onClose}>
      <p>{rows.length} {rows.length === 1 ? "issue" : "issues"}: {rows.map((row) => row.identifier).join(", ")}</p>
      {!estimatesReady && !message && <p role="status">Loading current estimates…</p>}
      <form onSubmit={(event) => { event.preventDefault(); void apply(); }}>
        {options ? estimatesReady && <IssueKeyboardFields field={field} rows={rows} options={options} value={value} setValue={setValue}
          labels={labels} setLabels={setLabels} disabled={busy || conflict || !estimatesReady} /> : <p role="alert">Issue choices are unavailable. Close this dialog and retry loading choices.</p>}
        {overLimit && <p role="alert">Select at most {options?.bulkEditIssuesPerOperation} issues.</p>}
        {tooManyLabels && <p role="alert">Choose at most {options?.labelsPerIssue} labels.</p>}
        <button type="submit" disabled={busy || conflict || !estimatesReady || !options || unavailable || overLimit || tooManyLabels}>{busy ? "Applying…" : "Apply changes"}</button>
      </form>
      {message && <p role="alert">{message}</p>}
      {failures.length > 0 && <div role="alert"><p>Nothing was changed.</p><ul>{failures.map((failure) =>
        <li key={failure.identifier}><strong>{failure.identifier}</strong>: {failure.reasons.join("; ")}</li>)}</ul></div>}
      {conflict && <IssueKeyboardReview submitted={rows} onUse={(current) => {
        setRows(current); setConflict(false); setMessage(""); setFailures([]);
      }} />}
    </IssueKeyboardModal>
  );
}
