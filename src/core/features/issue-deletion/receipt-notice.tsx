import { useEffect, useState } from "react";
import { fetchJson } from "../../app/api-client";
import { deletionReceiptSchema, type DeletionReceipt } from "./ui";
import "./receipt-notice.css";
/** App-shell custody keeps an authorized receipt visible after closing the issue. */
export function DeletionNotice() {
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const receive = (event: Event) => {
      const parsed = deletionReceiptSchema.safeParse(
        (event as CustomEvent).detail,
      );
      if (parsed.success) {
        setReceipt(parsed.data);
        setError("");
      }
    };
    const clear = () => setReceipt(null);
    window.addEventListener("vector:issue-deleted", receive);
    window.addEventListener("vector:auth-lost", clear);
    return () => {
      window.removeEventListener("vector:issue-deleted", receive);
      window.removeEventListener("vector:auth-lost", clear);
    };
  }, []);
  async function refresh() {
    if (!receipt) return;
    setBusy(true);
    try {
      setReceipt(await fetchJson(receipt.statusUrl, deletionReceiptSchema));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receipt unavailable.");
    } finally {
      setBusy(false);
    }
  }
  if (!receipt) return null;
  return (
    <section
      className="issue-deletion-receipt"
      aria-live="polite"
      aria-label="Issue deletion receipt"
    >
      <div>
        <strong>{receipt.identifier} deleted</strong>
        <p>
          {receipt.cleanup === "complete"
            ? "Attachment cleanup confirmed."
            : receipt.cleanup === "failed"
              ? "Attachment cleanup failed. Cleanup will retry automatically."
              : "Attachment cleanup pending; an upload may still be settling."}{" "}
          {receipt.removed} of {receipt.files} files removed.
        </p>
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="issue-deletion-receipt-actions">
        {receipt.cleanup !== "complete" && (
          <button type="button" disabled={busy} onClick={refresh}>
            Check cleanup status
          </button>
        )}
        <a href={receipt.statusUrl} target="_blank" rel="noopener noreferrer">
          Open receipt
        </a>
        <button type="button" onClick={() => setReceipt(null)}>
          Dismiss
        </button>
      </div>
    </section>
  );
}
