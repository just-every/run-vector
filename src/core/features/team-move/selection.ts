import type { BulkTeamInput } from "../bulk-commands/input";
import { commandValidation } from "../bulk-commands/validation";

const reasons = {
  unavailable: "Issue is unavailable.",
  stale: "The issue version is stale.",
  team: "Choose an available team in this workspace.",
  status: "Choose an explicit target status in the issue's current category.",
  sameTeam: "Use the issue editor to change status within the current team.",
};
export type TeamSelectionRow = {
  identifier: string; id: string; team_id: string; status_id: string;
  cycle_id: string | null; version: number;
} & Record<keyof typeof reasons, number>;

export function teamSelection(db: D1Database, actor: string, input: BulkTeamInput) {
  return commandValidation(db, `WITH requested AS (
    SELECT json_extract(value,'$.identifier') identifier,json_extract(value,'$.expectedVersion') version,
      json_extract(value,'$.statusId') status_id FROM json_each(?)
    ), target AS (SELECT ? team_id)
    SELECT r.identifier,i.id,i.team_id,i.status_id,i.cycle_id,i.version,
      i.id IS NULL AS unavailable,
      i.id IS NOT NULL AND i.version<>r.version AS stale,
      NOT EXISTS(SELECT 1 FROM teams n WHERE n.id=target.team_id AND n.workspace_id=t.workspace_id AND n.archived_at IS NULL) AS team,
      NOT EXISTS(SELECT 1 FROM workflow_statuses n WHERE n.id=r.status_id AND n.team_id=target.team_id AND n.category=s.category) AS status,
      i.team_id=target.team_id AND i.status_id<>r.status_id AS sameTeam
    FROM requested r CROSS JOIN target LEFT JOIN issues i ON i.identifier=r.identifier AND EXISTS(
      SELECT 1 FROM teams scope JOIN operators actor ON actor.workspace_id=scope.workspace_id
      WHERE scope.id=i.team_id AND actor.id=? AND actor.removed_at IS NULL)
    LEFT JOIN teams t ON t.id=i.team_id
    LEFT JOIN workflow_statuses s ON s.id=i.status_id AND s.team_id=i.team_id`,
  [JSON.stringify(input.issues), input.teamId, actor], reasons);
}
