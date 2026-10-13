import type {Session} from '../../../vendor/base/operator-auth/index.mjs';
/** Base gives equal product operators owner authority. Management admission
 * additionally belongs to the explicitly recorded installation owner. */
export async function currentEditorOwner(db:D1Database,session:Session){
 const row=await db.prepare(`SELECT o.id FROM workspace_installation w
  JOIN operators o ON o.id=w.setup_operator_id AND o.workspace_id=w.workspace_id
  JOIN vector_auth_operators m ON m.operator_id=o.id
  JOIN oa_operators a ON a.id=m.auth_id
  JOIN oa_sessions s ON s.operator_id=a.id
  WHERE a.id=? AND s.id=? AND a.status='active' AND a.role='owner'
  AND o.removed_at IS NULL AND s.revoked_at IS NULL
  AND s.operator_version=? AND a.version=s.operator_version
  AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
  AND (NOT EXISTS(SELECT 1 FROM vector_restore_status)
   OR EXISTS(SELECT 1 FROM vector_restore_operator_grants g WHERE g.auth_id=a.id))`)
  .bind(session.operatorId,session.id,session.operator.version).first<{id:string}>();
 return Boolean(row);
}
