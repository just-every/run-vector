import { z } from 'zod';
import type { WorkerBindings } from '../../../app/bindings';
import type { IntegrationOwner } from '../authority';
import { sha256 } from '../../../../../vendor/base/integrations/core/crypto';
import { auditStatement } from '../../audit/producer';
import { IntegrationError } from '../errors';
import { sealSecret, openSecret } from '../secrets';
import { appKey, memberKey, statePrefix, secretRow, loadApp, figmaSql } from './configuration';
import { figmaCallback } from './urls';
import { exchangeCode } from './client';

const pendingInput = z.object({ actor: z.string(), session: z.string(), app: z.string(), connection: z.string().nullable() });
const storedGrant = z.object({ token: z.string(), refresh: z.string(), expires: z.number(), app: z.string() });
export async function memberGrant(env: WorkerBindings, owner: IntegrationOwner) {
  const eligible = await env.DB.prepare("SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL AND role IN ('owner','admin','member')").bind(owner.id, owner.workspace).first();
  if (!eligible) return null;
  const row = await secretRow(env, memberKey(owner));
  if (!row) return null;
  const app = await secretRow(env, appKey(owner.workspace));
  const grant = storedGrant.parse(JSON.parse(await openSecret(env, memberKey(owner), row.encrypted)));
  if (!app || grant.app !== app.encrypted || grant.expires <= Date.now()) return null;
  return { ...row, ...grant };
}
export async function connectionStatus(env: WorkerBindings, owner: IntegrationOwner) {
  const [grant, row, app] = await Promise.all([memberGrant(env, owner), secretRow(env, memberKey(owner)), secretRow(env, appKey(owner.workspace))]);
  return { connected: Boolean(grant), available: Boolean(app), needsAttention: Boolean(row && !grant), requiresReentry: !app && Boolean(await env.DB.prepare('SELECT 1 FROM vector_figma_installations WHERE workspace_id=?').bind(owner.workspace).first()) };
}
export async function beginConnection(env: WorkerBindings, owner: IntegrationOwner) {
  const app = await loadApp(env, owner), connection = await secretRow(env, memberKey(owner));
  const state = crypto.randomUUID() + crypto.randomUUID(), key = statePrefix(owner) + await sha256(state);
  const encrypted = await sealSecret(env, key, JSON.stringify({ actor: owner.id, session: owner.fence.sessionId, app: app.encrypted, connection: connection?.encrypted ?? null }));
  await figmaSql(env, owner, 'personal').batch([
    { sql: 'DELETE FROM vector_integration_secret_keys WHERE substr(identity,1,?)=?', params: [statePrefix(owner).length, statePrefix(owner)] },
    { sql: "INSERT INTO vector_integration_secret_keys(identity,slot,encrypted,valid_until) VALUES(?,'current',?,?)", params: [key, encrypted, Date.now() + 600000] },
  ]);
  const url = new URL('https://www.figma.com/oauth');
  for (const [key, value] of Object.entries({ client_id: app.profile.clientId, redirect_uri: figmaCallback(env.APP_ORIGIN), scope: 'file_content:read', state, response_type: 'code' })) url.searchParams.set(key, value);
  return { url: url.href };
}
export async function completeConnection(env: WorkerBindings, owner: IntegrationOwner, query: Record<string, string>) {
  const parsed = z.object({ state: z.string().length(72), code: z.string().min(1).max(2000) }).strict().safeParse(query);
  if (!parsed.success) throw new IntegrationError(400, 'figma_oauth_refused');
  const key = statePrefix(owner) + await sha256(parsed.data.state), row = await secretRow(env, key);
  if (!row || !row.expires || row.expires <= Date.now()) throw new IntegrationError(403, 'figma_state_invalid');
  const pending = pendingInput.parse(JSON.parse(await openSecret(env, key, row.encrypted))), app = await loadApp(env, owner);
  if (pending.actor !== owner.id || pending.session !== owner.fence.sessionId || pending.app !== app.encrypted) throw new IntegrationError(403, 'figma_state_invalid');
  const used = await figmaSql(env, owner, 'personal').batch([{ sql: "UPDATE vector_integration_secret_keys SET slot='used' WHERE identity=? AND slot='current' AND encrypted=? AND valid_until>? RETURNING encrypted", params: [key, row.encrypted, Date.now()] }]);
  if (!used[0].length) throw new IntegrationError(403, 'figma_state_invalid');
  const token = await exchangeCode(app.profile.clientId, app.profile.clientSecret, parsed.data.code, figmaCallback(env.APP_ORIGIN));
  const encrypted = await sealSecret(env, memberKey(owner), JSON.stringify({ ...token, app: app.encrypted }));
  await figmaSql(env, owner, 'personal').batch([
    { sql: "SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_integration_secret_keys WHERE identity=? AND slot='used' AND encrypted=? AND valid_until>?) AND EXISTS(SELECT 1 FROM vector_integration_secret_keys WHERE identity=? AND slot='current' AND encrypted=?) AND COALESCE((SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot='current'),'')=? THEN 1 ELSE json('Figma connection changed') END", params: [key, row.encrypted, Date.now(), appKey(owner.workspace), app.encrypted, memberKey(owner), pending.connection ?? ''] },
    { sql: "INSERT INTO vector_integration_secret_keys(identity,slot,encrypted,valid_until) VALUES(?,'current',?,?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted,valid_until=excluded.valid_until", params: [memberKey(owner), encrypted, token.expires] },
    { sql: "DELETE FROM vector_integration_secret_keys WHERE identity=? AND slot='used'", params: [key] },
    auditStatement({ workspace: owner.workspace, actor: owner.id, action: 'figma.member_connected', subject: owner.id }),
  ]);
  return { connected: true };
}
export async function disconnectFigma(env: WorkerBindings, owner: IntegrationOwner) {
  await figmaSql(env, owner).batch([
    { sql: 'DELETE FROM vector_integration_secret_keys WHERE identity=? OR substr(identity,1,?)=?', params: [memberKey(owner), statePrefix(owner).length, statePrefix(owner)] },
    auditStatement({ workspace: owner.workspace, actor: owner.id, action: 'figma.member_disconnected', subject: owner.id }),
  ]);
  return { disconnected: true, providerAction: 'Revoke the Vector grant in Figma to remove provider access too.' };
}
