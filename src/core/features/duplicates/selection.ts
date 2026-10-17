import type { BulkDuplicateInput } from "../bulk-commands/input";
import { commandValidation } from "../bulk-commands/validation";
import { defaultDuplicateStatus, duplicateRestoreStatus } from "./status";

const reasons = {
  unavailable: "Issue is unavailable.",
  stale: "The issue version is stale.",
  canonicalUnavailable: "The canonical issue is unavailable in this workspace.",
  canonicalSelected: "Choose a canonical issue outside the selected issues.",
  canonicalDuplicate: "Choose a canonical issue that is not already a duplicate.",
  missingDecision: "This issue is not a duplicate.",
  status: "An available workflow status is required for this duplicate decision.",
  cascade: "An incoming duplicate is unavailable in this workspace.",
};
export type DuplicateSelectionRow = {
  identifier: string; id: string; version: number; target_id: string | null;
} & Record<keyof typeof reasons, number>;

export function duplicateSelection(db: D1Database, actor: string, input: BulkDuplicateInput) {
  return commandValidation(db, `WITH requested AS (
    SELECT json_extract(value,'$.identifier') identifier,json_extract(value,'$.expectedVersion') version FROM json_each(?)
    ), command AS (SELECT ? canonical_identifier), operator AS (
      SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL
    ), target AS (
      SELECT c.id,s.category FROM command JOIN issues c ON c.identifier=command.canonical_identifier
      JOIN teams t ON t.id=c.team_id JOIN operator ON operator.workspace_id=t.workspace_id
      JOIN workflow_statuses s ON s.id=c.status_id AND s.team_id=c.team_id
    )
    SELECT r.identifier,i.id,i.version,(SELECT id FROM target) target_id,
      i.id IS NULL AS unavailable,
      i.id IS NOT NULL AND i.version<>r.version AS stale,
      command.canonical_identifier IS NOT NULL AND NOT EXISTS(SELECT 1 FROM target) AS canonicalUnavailable,
      command.canonical_identifier IS NOT NULL AND EXISTS(SELECT 1 FROM requested s WHERE s.identifier=command.canonical_identifier) AS canonicalSelected,
      command.canonical_identifier IS NOT NULL AND EXISTS(SELECT 1 FROM target WHERE category='duplicate' OR EXISTS(SELECT 1 FROM issue_duplicates d WHERE d.issue_id=target.id)) AS canonicalDuplicate,
      command.canonical_identifier IS NULL AND NOT EXISTS(SELECT 1 FROM issue_duplicates d WHERE d.issue_id=i.id) AS missingDecision,
      (CASE WHEN command.canonical_identifier IS NOT NULL THEN ${defaultDuplicateStatus} ELSE ${duplicateRestoreStatus} END) IS NULL AS status,
      command.canonical_identifier IS NOT NULL AND EXISTS(
        SELECT 1 FROM issue_duplicates d JOIN issues incoming ON incoming.id=d.issue_id
        JOIN teams incoming_team ON incoming_team.id=incoming.team_id
        WHERE d.canonical_issue_id=i.id AND NOT EXISTS(SELECT 1 FROM operator WHERE operator.workspace_id=incoming_team.workspace_id)
      ) AS cascade
    FROM requested r CROSS JOIN command LEFT JOIN issues i ON i.identifier=r.identifier AND EXISTS(
      SELECT 1 FROM teams scope JOIN operator ON operator.workspace_id=scope.workspace_id WHERE scope.id=i.team_id)`,
  [JSON.stringify(input.issues), input.canonicalIdentifier, actor], reasons);
}
