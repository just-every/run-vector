import { opaqueToken, hashToken } from '../../vendor/base/operator-auth/crypto.mjs'
import { createUlid } from '../../src/core/shared/ids'
export const testSecret = 'synthetic-local-test-auth-secret-with-at-least-32-characters'
export async function testCookie(db: D1Database, operatorId: string, expiresAt=new Date(Date.now()+86400000).toISOString(), revokedAt: string|null=null) {
 const token=opaqueToken(), now=Date.now()
 await db.prepare(`INSERT INTO oa_sessions(id,operator_id,operator_version,kind,token_hash,expires_at,revoked_at,created_at)
 SELECT ?,a.id,a.version,'native',?,?,?,? FROM oa_operators a JOIN vector_auth_operators m ON m.auth_id=a.id WHERE m.operator_id=?`)
 .bind(createUlid(new Date()),await hashToken(testSecret,'session',token),Date.parse(expiresAt),revokedAt===null?null:Date.parse(revokedAt),now,operatorId).run()
 // Base names the local cookie per origin port; the worker tests use 15920.
 return `__Host-operator_session=${token}; operator_session_local_15920=${token}`
}
export const testSessionHash = (token:string) => hashToken(testSecret,'session',token.split(';')[0])
export async function testSessionFence(db:D1Database, cookie:string) {
 const row=await db.prepare('SELECT id,operator_version FROM oa_sessions WHERE token_hash=?').bind(await testSessionHash(cookie.split('=')[1])).first<{id:string;operator_version:number}>()
 if(!row)throw Error('Test session is absent')
 return {sessionId:row.id,operatorVersion:row.operator_version}
}
