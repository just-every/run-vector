import type { DoorRequest } from "../roles/doors";
import { visibilityDatabase } from "../roles/visibility-database";
import { visibleTeam } from "../roles/visibility-sql";

/** Match project visibility for each recipient, independently of the writer. */
export const visibleProject = (person: string, project: string) => `(
  ${project}.workspace_id=${person}.workspace_id AND (
    EXISTS(SELECT 1 FROM main.issues child WHERE child.project_id=${project}.id AND ${visibleTeam(person, 'child.team_id')})
    OR (${person}.role<>'guest' AND NOT EXISTS(SELECT 1 FROM main.issues child WHERE child.project_id=${project}.id))))`;

export async function updateDoorProject({ db, actor, params }: DoorRequest) {
  return (await visibilityDatabase(db, actor).prepare('SELECT id FROM projects WHERE id=?')
    .bind(params.projectId).first<{id:string}>())?.id ?? null;
}
export const updateAuthority = `EXISTS(SELECT 1 FROM projects p JOIN operators o ON o.workspace_id=p.workspace_id
  WHERE p.id=? AND o.id=? AND o.removed_at IS NULL
  AND (o.role IN ('owner','admin') OR (o.role='member' AND p.lead_operator_id=o.id)))`;
