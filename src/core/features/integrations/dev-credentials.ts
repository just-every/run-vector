import { devAdmitted } from '../../../../vendor/base/operator-auth/dev-admission.mjs'
// A token minted while signed in with a dev session is recorded in oa_dev_credentials. Like the dev session itself
// it counts only on a request that passes the local key gate, so a Worker that never registers the gate (the
// deployed one) refuses every dev-minted token.
export async function recordDevMint(db: D1Database, sessionId: string, tokenId: string) {
  await db.prepare("INSERT INTO oa_dev_credentials(credential,id,created_at) SELECT 'integration_tokens',?,? WHERE EXISTS(SELECT 1 FROM oa_sessions WHERE id=? AND kind='dev')")
    .bind(tokenId, Date.now(), sessionId).run()
}
export async function devMintRefused(db: D1Database, request: Request, tokenId: string) {
  return !(await devAdmitted(request)) && Boolean(await db.prepare("SELECT 1 FROM oa_dev_credentials WHERE credential='integration_tokens' AND id=?").bind(tokenId).first())
}
