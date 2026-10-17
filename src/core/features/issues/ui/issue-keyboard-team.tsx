import { useApiResource } from "../../../app/api-client";
import type { WorkspaceOptions } from "../../../shared/workspace-options";
import { issueDetailSchema } from "./data";
import { IssueKeyboardModal } from "./issue-keyboard-modal";
import { TeamMove } from "./team-move";

export function IssueKeyboardTeam({ identifier, options, onClose, onRefresh }: {
  identifier: string;
  options: WorkspaceOptions | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const detail = useApiResource(`/api/issues/${encodeURIComponent(identifier)}`, issueDetailSchema);
  return (
    <IssueKeyboardModal title="Move team" onClose={onClose}>
      <p>{identifier}</p>
      {detail.data && <TeamMove issue={detail.data} options={options} optionsError={null}
        onRefresh={() => { detail.reload(); onRefresh(); }} />}
      {detail.loading && !detail.data && <p role="status">Loading issue…</p>}
      {detail.error && <p role="alert">{detail.error.message} <button onClick={detail.reload}>Retry</button></p>}
    </IssueKeyboardModal>
  );
}
