import type { requireOperator } from "./service";

type SessionFence = NonNullable<
  Awaited<ReturnType<typeof requireOperator>>
>["fence"];

/** Embed in the final projection query with the product operator aliased actor. */
export function nativeSessionAdmission(fence: SessionFence) {
  return {
    sql: `EXISTS(SELECT 1 FROM vector_auth_operators m JOIN oa_sessions s ON s.operator_id=m.auth_id
          JOIN oa_operators a ON a.id=m.auth_id WHERE m.operator_id=actor.id
          AND s.id=? AND s.operator_version=? AND a.version=s.operator_version
          AND a.status='active' AND s.revoked_at IS NULL
          AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))`,
    values: [fence.sessionId, fence.operatorVersion],
  };
}

/** Distinguish revoked identity from a live identity leaving its admitted workspace. */
export async function operatorProjectionStatus(
  db: D1Database,
  operatorId: string,
  workspaceId: string | null,
  fence: SessionFence,
): Promise<200 | 401 | 404> {
  const session = nativeSessionAdmission(fence);
  const row = await db
    .prepare(
      `SELECT actor.workspace_id, ${session.sql} AS active
    FROM operators actor WHERE actor.id=? AND actor.removed_at IS NULL`,
    )
    .bind(...session.values, operatorId)
    .first<{ workspace_id: string; active: number }>();
  if (!row || row.active !== 1) return 401;
  return row.workspace_id === workspaceId ? 200 : 404;
}

export async function operatorProjectionAdmitted(
  db: D1Database,
  operatorId: string,
  workspaceId: string | null,
  fence: SessionFence,
) {
  return (
    (await operatorProjectionStatus(db, operatorId, workspaceId, fence)) === 200
  );
}
