/** Restoration preserves identities/history, and requires fresh destination access. */
export async function restoredEffectsHeld(db: D1Database) {
 return Boolean(await db.prepare('SELECT id FROM vector_restore_status WHERE effects_held=1').first());
}
/** If the historical installation owner was removed, only trusted deployment
 * configuration can name an already-active replacement. Request data cannot. */
export async function establishRestoredOwner(db:D1Database,email:string) {
 await db.prepare(`INSERT INTO vector_restore_operator_grants(auth_id,approved_at)
  SELECT a.id,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM oa_operators a
  JOIN vector_auth_operators m ON m.auth_id=a.id JOIN operators o ON o.id=m.operator_id
  JOIN workspace_settings w ON w.id=o.workspace_id
  WHERE a.email=? AND a.status='active' AND o.removed_at IS NULL
  AND EXISTS(SELECT 1 FROM vector_restore_status)
  AND NOT EXISTS(SELECT 1 FROM vector_restore_operator_grants)
  ON CONFLICT(auth_id) DO NOTHING`).bind(email.trim().toLowerCase()).run();
}
export async function restoredOperatorAdmitted(db: D1Database, authId: string) {
 const row = await db.prepare(`SELECT NOT EXISTS(SELECT 1 FROM vector_restore_status)
 OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=?) AS allowed`).bind(authId).first<{allowed:number}>();
 return row?.allowed === 1;
}
export async function restoredEmailAdmitted(db: D1Database, email: string) {
 const row = await db.prepare(`SELECT NOT EXISTS(SELECT 1 FROM vector_restore_status)
 OR EXISTS(SELECT 1 FROM oa_operators a JOIN vector_restore_operator_grants g ON g.auth_id=a.id
 WHERE a.email=? AND a.status IN ('active','invited')) AS allowed`).bind(email.trim().toLowerCase()).first<{allowed:number}>();
 return row?.allowed === 1;
}
