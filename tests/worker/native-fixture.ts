import { digest, randomToken } from '../../src/core/features/auth/repository'
import { createUlid } from '../../src/core/shared/ids'
export async function testCookie(
  db: D1Database,
  operatorId: string,
  expiresAt = new Date(Date.now() + 86400000).toISOString(),
  revokedAt: string | null = null,
) {
  const token = randomToken(),
    now = new Date().toISOString()
  await db
    .prepare(
      'INSERT INTO operator_sessions(id,operator_id,token_hash,expires_at,revoked_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
    )
    .bind(
      createUlid(new Date()),
      operatorId,
      await digest(token),
      expiresAt,
      revokedAt,
      now,
      now,
    )
    .run()
  return `vector_session=${token}`
}
