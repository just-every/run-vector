import { useState } from "react";
import type { WorkspaceOptions } from "../../../shared/workspace-options";
import type { BulkReceipt, IssueEditTarget } from "./issue-keyboard-actions";
import { IssueCommandFeedback, useIssueCommandSession } from "./issue-command-session";
import { IssueKeyboardModal } from "./issue-keyboard-modal";

export function IssueKeyboardTeam({ targets, options, onClose, onSuccess }: {
  targets: IssueEditTarget[];
  options: WorkspaceOptions | null;
  onClose: () => void;
  onSuccess: (receipt: BulkReceipt) => void;
}) {
  const session = useIssueCommandSession(targets, onSuccess);
  const [teamId, setTeamId] = useState("");
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const categories = [...new Set(session.rows.map(row => row.status.category))];
  const valid = options && teamId && categories.every(category => options.statuses.some(status =>
    status.teamId === teamId && status.category === category && status.id === statuses[category]));
  const overLimit = !!options && session.rows.length > options.bulkEditIssuesPerOperation;
  return <IssueKeyboardModal title="Move team" busy={session.busy} onClose={onClose}>
    <p>{session.rows.length} {session.rows.length === 1 ? "issue" : "issues"}: {session.rows.map(row => row.identifier).join(", ")}</p>
    <p>Identifiers and history stay the same. Each issue leaves its cycle and keeps its status category.</p>
    <form onSubmit={event => {
      event.preventDefault();
      if (valid && !overLimit) void session.submit("team", { teamId, issues: session.rows.map(row => ({
        identifier: row.identifier, expectedVersion: row.version, statusId: statuses[row.status.category],
      })) });
    }}>
      <label>Target team<select autoFocus aria-label="Target team" value={teamId}
        disabled={!options || session.busy || session.conflict}
        onChange={event => { setTeamId(event.target.value); setStatuses({}); }}>
        <option value="">Choose a team</option>
        {options?.teams.map(team => <option value={team.id} key={team.id}>{team.name}</option>)}
      </select></label>
      {categories.map(category => <label key={category}>Target status · {category}
        <select aria-label={`Target status · ${category}`} value={statuses[category] ?? ""}
          disabled={!teamId || session.busy || session.conflict}
          onChange={event => setStatuses(current => ({ ...current, [category]: event.target.value }))}>
          <option value="">Choose a {category} status</option>
          {options?.statuses.filter(status => status.teamId === teamId && status.category === category)
            .map(status => <option key={status.id} value={status.id}>{status.name}</option>)}
        </select>
      </label>)}
      {overLimit && <p role="alert">Select at most {options?.bulkEditIssuesPerOperation} issues.</p>}
      {!options && <p role="alert">Team choices are unavailable. Close and retry loading choices.</p>}
      <button disabled={!valid || overLimit || session.busy || session.conflict} type="submit">{session.busy ? "Moving…" : "Move selected issues"}</button>
    </form>
    <IssueCommandFeedback session={session} />
  </IssueKeyboardModal>;
}
