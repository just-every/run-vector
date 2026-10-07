import { localMailSender } from './base.server'
import { createUlid } from '../../shared/ids'
const SESSION_MS = 30 * 86_400_000
export async function digest(token: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}
export async function activeSession(
  db: D1Database,
  token: string,
  now = new Date(),
) {
  const hash = await digest(token)
  const row = await db
    .prepare(
      `SELECT o.id, o.name, o.email FROM operator_sessions s JOIN operators o ON o.id=s.operator_id
 WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND o.removed_at IS NULL`,
    )
    .bind(hash, now.toISOString())
    .first<{ id: string; name: string; email: string }>()
  if (row)
    await db
      .prepare(
        'UPDATE operator_sessions SET updated_at=?,expires_at=? WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?',
      )
      .bind(
        now.toISOString(),
        new Date(now.getTime() + SESSION_MS).toISOString(),
        hash,
        now.toISOString(),
      )
      .run()
  return row
}
export async function requestMagicLink(
  db: D1Database,
  email: string,
  origin: string,
  returnTo: string,
  now = new Date(),
) {
  const operator = await db
    .prepare(
      'SELECT id FROM operators WHERE lower(email)=? AND removed_at IS NULL',
    )
    .bind(email.toLowerCase())
    .first<{ id: string }>()
  if (!operator) return
  const token = randomToken(),
    id = createUlid(now),
    at = now.toISOString()
  const url = new URL('/auth/consume', origin)
  url.searchParams.set('token', token)
  await db.batch([
    db
      .prepare(
        `INSERT INTO magic_links(id,operator_id,token_hash,return_to,expires_at,created_at,updated_at)
 SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM operators WHERE id=? AND removed_at IS NULL AND lower(email)=?)`,
      )
      .bind(
        id,
        operator.id,
        await digest(token),
        returnTo,
        new Date(now.getTime() + 15 * 60_000).toISOString(),
        at,
        at,
        operator.id,
        email.toLowerCase(),
      ),
  ])
  try {
    await localMailSender(db, url.href, id).send({
      deliveryId: id, from: 'Vector local <signin@vector.test>', to: [email],
      subject: 'Your local sign-in link', text: url.href, headers: {},
    })
  } catch (error) {
    await db.prepare('DELETE FROM magic_links WHERE id=?').bind(id).run()
    throw error
  }
}
export async function consumeMagicLink(
  db: D1Database,
  token: string,
  now = new Date(),
) {
  const hash = await digest(token),
    session = randomToken(),
    sessionId = createUlid(now),
    at = now.toISOString()
  const writes = await db.batch([
    db
      .prepare(
        `INSERT INTO operator_sessions(id,operator_id,token_hash,expires_at,created_at,updated_at)
 SELECT ?, m.operator_id, ?, ?, ?, ? FROM magic_links m JOIN operators o ON o.id=m.operator_id
 WHERE m.token_hash=? AND m.consumed_at IS NULL AND m.expires_at>? AND o.removed_at IS NULL`,
      )
      .bind(
        sessionId,
        await digest(session),
        new Date(now.getTime() + SESSION_MS).toISOString(),
        at,
        at,
        hash,
        at,
      ),
    db
      .prepare(
        'UPDATE magic_links SET consumed_at=?,updated_at=? WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?',
      )
      .bind(at, at, hash, at),
  ])
  if (writes[0].meta.changes !== 1) return null
  const link = await db
    .prepare('SELECT return_to FROM magic_links WHERE token_hash=?')
    .bind(hash)
    .first<{ return_to: string }>()
  if (!link) throw new Error('Consumed magic link is missing.')
  return { token: session, returnTo: link.return_to }
}
export async function revokeSession(db: D1Database, token: string) {
  await db
    .prepare(
      'UPDATE operator_sessions SET revoked_at=?,updated_at=? WHERE token_hash=?',
    )
    .bind(
      new Date().toISOString(),
      new Date().toISOString(),
      await digest(token),
    )
    .run()
}
export async function admitRate(
  db: D1Database,
  key: string,
  maximum: number,
  durationMs: number,
) {
  const now = Date.now(),
    window = Math.floor(now / durationMs),
    bucket = key + ':' + window
  const row = await db
    .prepare(
      `INSERT INTO access_rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`,
    )
    .bind(bucket, new Date((window + 1) * durationMs).toISOString())
    .first<{ count: number }>()
  return !!row && row.count <= maximum
}
