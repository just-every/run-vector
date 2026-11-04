import { SettingsError } from './repository';

/** Both names are projections of the same native identity; never accept a target ID. */
export async function updateDisplayName(db: D1Database, actor: string, name: string) {
  const at = new Date().toISOString();
  const [changed] = await db.batch([
    db.prepare(`UPDATE operators SET name=?,updated_at=? WHERE id=? AND removed_at IS NULL
      AND EXISTS(SELECT 1 FROM vector_auth_operators m JOIN oa_operators a ON a.id=m.auth_id WHERE m.operator_id=operators.id AND a.status='active') RETURNING id`)
      .bind(name, at, actor),
    db.prepare(`UPDATE oa_operators SET display_name=? WHERE status='active'
      AND id=(SELECT m.auth_id FROM vector_auth_operators m JOIN main.operators o ON o.id=m.operator_id WHERE o.id=? AND o.removed_at IS NULL AND o.name=?)`)
      .bind(name, actor, name),
  ]);
  if (changed.results.length !== 1)
    throw new SettingsError('unauthenticated', 'Sign in again to change your name.', 401);
}
