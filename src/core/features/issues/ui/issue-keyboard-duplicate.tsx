import { useState } from "react";
import type { BulkReceipt, IssueEditTarget } from "./issue-keyboard-actions";
import { IssueCommandFeedback, useIssueCommandSession } from "./issue-command-session";
import { IssueKeyboardModal } from "./issue-keyboard-modal";

export function IssueKeyboardDuplicate({ targets, limit, onClose, onSuccess }: {
  targets: IssueEditTarget[];
  limit: number | undefined;
  onClose: () => void;
  onSuccess: (receipt: BulkReceipt) => void;
}) {
  const session = useIssueCommandSession(targets, onSuccess);
  const [canonical, setCanonical] = useState("");
  const overLimit = limit !== undefined && session.rows.length > limit;
  const disabled = session.busy || session.conflict || overLimit || limit === undefined;
  const issues = session.rows.map(row => ({ identifier: row.identifier, expectedVersion: row.version }));
  return <IssueKeyboardModal title="Duplicate decision" busy={session.busy} onClose={onClose}>
    <p>{session.rows.length} {session.rows.length === 1 ? "issue" : "issues"}: {session.rows.map(row => row.identifier).join(", ")}</p>
    <p>Choose the original issue for the entire selection. Descriptions, comments and history stay on their original issues.</p>
    <form onSubmit={event => {
      event.preventDefault();
      if (!disabled) void session.submit("duplicate", { issues, canonicalIdentifier: canonical.trim().toUpperCase() });
    }}>
      <label>Original issue<input autoFocus aria-label="Original issue" value={canonical}
        onChange={event => setCanonical(event.target.value)} required pattern="[A-Za-z]{2,10}-[1-9][0-9]*" disabled={disabled} /></label>
      <button type="submit" disabled={disabled || !/^[A-Z]{2,10}-[1-9][0-9]*$/.test(canonical.trim().toUpperCase())}>Mark selected as duplicates</button>
    </form>
    <button type="button" disabled={disabled} onClick={() => void session.submit("duplicate", { issues, canonicalIdentifier: null })}>Remove duplicate decision</button>
    <p>Removing a duplicate decision restores each issue’s previous nonterminal status. Every selected issue must currently be a duplicate.</p>
    {overLimit && <p role="alert">Select at most {limit} issues.</p>}
    {limit === undefined && <p role="alert">Issue choices are unavailable. Close and retry loading choices.</p>}
    <IssueCommandFeedback session={session} />
  </IssueKeyboardModal>;
}
