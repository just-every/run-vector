import { useRef, useState } from "react";
import { z } from "zod";
import { fetchJson, useApiResource } from "../../app/api-client";
import type { IssueDetailData } from "../issues/ui/data";
import { roles } from "../roles/matrix";
import { decide } from "../roles/policy";
const viewerSchema = z.object({ role: z.enum(roles) });
export const deletionReceiptSchema = z.object({
  identifier: z.string(),
  deleted: z.literal(true),
  cleanup: z.enum(["complete", "pending", "failed"]),
  files: z.number(),
  removed: z.number(),
  statusUrl: z.string(),
});
export type DeletionReceipt = z.infer<typeof deletionReceiptSchema>;
export function DeleteIssue({
  issue,
  onDeleted,
  onRefresh,
}: {
  issue: IssueDetailData;
  onDeleted: (receipt: DeletionReceipt) => void;
  onRefresh: () => void;
}) {
  const viewer = useApiResource("/api/session", viewerSchema, 5000, { abortPendingOnDispose: false });
  const trigger = useRef<HTMLButtonElement>(null),
    [version, setVersion] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function cancel() {
    setVersion(null);
    setError("");
    requestAnimationFrame(() => trigger.current?.focus());
  }
  async function remove() {
    if (version === null) return;
    setBusy(true);
    setError("");
    try {
      onDeleted(
        await fetchJson(
          `/api/issues/${issue.identifier}`,
          deletionReceiptSchema,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expectedVersion: version, confirmed: true }),
          },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion could not complete.");
      onRefresh();
    } finally {
      setBusy(false);
    }
  }
  if (!viewer.data || viewer.error || decide(
    { role: viewer.data.role, memberInvites: false, teams: new Map() },
    { row: "issues.delete-permanent" },
  ) !== "allow") return null;
  return (
    <section className="detail-section issue-deletion">
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setVersion(issue.version);
          setError("");
        }}
        disabled={busy || version !== null}
      >
        Delete issue
      </button>
      {version !== null && (
        <div
          role="group"
          aria-label={`Delete ${issue.identifier}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              if (!busy) cancel();
            }
          }}
        >
          <p>
            Delete {issue.identifier}? This removes its discussion, attachments,
            evidence, links and notifications. Children become root issues. Its
            identifier and minimal audit history remain reserved. Any imported
            original containing this issue is withdrawn in full.
          </p>
          {issue.duplicates.length > 0 && (
            <p role="alert">
              Repoint or undo these duplicates first:{" "}
              {issue.duplicates.map((i) => i.identifier).join(", ")}.
            </p>
          )}
          {version !== issue.version && (
            <p role="alert">
              The issue changed. Cancel and review it before confirming again.
            </p>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={
              busy || version !== issue.version || issue.duplicates.length > 0
            }
          >
            {busy ? "Deleting…" : "Confirm deletion"}
          </button>{" "}
          <button type="button" autoFocus disabled={busy} onClick={cancel}>
            Cancel
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
