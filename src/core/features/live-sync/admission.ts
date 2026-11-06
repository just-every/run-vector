import type { WorkerBindings } from '../../app/bindings';
import { nativeSessionAdmission } from '../auth/projection-admission';
import { visibleTeam } from '../roles/visibility-sql';

/** Hibernating sockets retain identity fences, never cookies or product content. */
export type LiveReader = {
  actor: string;
  workspace: string;
  fence: { sessionId: string; operatorVersion: number };
};

export async function liveAdmission(db: WorkerBindings['DB'], reader: LiveReader, event?: string) {
  const session = nativeSessionAdmission(reader.fence);
  return await db.prepare(`SELECT (${session.sql}
    AND actor.workspace_id=? AND (NOT EXISTS(SELECT 1 FROM vector_restore_status)
      OR EXISTS(SELECT 1 FROM vector_restore_operator_grants g JOIN vector_auth_operators m ON m.auth_id=g.auth_id WHERE m.operator_id=actor.id))) AS active,
    EXISTS(SELECT 1 FROM issue_activity a JOIN issues i ON i.id=a.issue_id
      JOIN teams t ON t.id=i.team_id WHERE a.id=? AND t.workspace_id=actor.workspace_id
      AND ${visibleTeam('actor', 't.id')}) AS visible
    FROM operators actor WHERE actor.id=? AND actor.removed_at IS NULL`)
    .bind(...session.values, reader.workspace, event ?? '', reader.actor)
    .first<{ active: number; visible: number }>();
}
