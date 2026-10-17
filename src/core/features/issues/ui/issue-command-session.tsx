import { useState } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import { bulkFailuresSchema, bulkReceiptSchema, type BulkReceipt, type IssueEditTarget } from "./issue-keyboard-actions";
import { IssueKeyboardReview } from "./issue-keyboard-review";

export function useIssueCommandSession(targets: IssueEditTarget[], onSuccess: (receipt: BulkReceipt) => void) {
  const [rows, setRows] = useState(() => structuredClone(targets));
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const [failures, setFailures] = useState<Array<{ identifier: string; reasons: string[] }>>([]);
  async function submit(command: "team" | "duplicate", body: unknown) {
    if (busy || conflict) return;
    setBusy(true); setMessage(""); setFailures([]);
    try {
      const receipt = await fetchJson(`/api/issues/bulk/${command}`, bulkReceiptSchema, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      onSuccess(receipt);
    } catch (cause) {
      const parsed = cause instanceof ApiError ? bulkFailuresSchema.safeParse(cause.body) : null;
      if (parsed?.success) setFailures(parsed.data.failures);
      setConflict(cause instanceof ApiError && cause.status === 409);
      setMessage(cause instanceof Error ? cause.message : "The command could not complete.");
    } finally { setBusy(false); }
  }
  function useReviewed(current: IssueEditTarget[]) {
    setRows(current); setConflict(false); setMessage(""); setFailures([]);
  }
  return { rows, busy, conflict, message, failures, submit, useReviewed };
}

export function IssueCommandFeedback({ session }: { session: ReturnType<typeof useIssueCommandSession> }) {
  return <>
    {session.message && <p role="alert">{session.message}</p>}
    {session.failures.length > 0 && <div role="alert"><p>Nothing was changed.</p><ul>
      {session.failures.map(row => <li key={row.identifier}><strong>{row.identifier}</strong>: {row.reasons.join("; ")}</li>)}
    </ul></div>}
    {session.conflict && <IssueKeyboardReview submitted={session.rows} onUse={session.useReviewed} />}
  </>;
}
