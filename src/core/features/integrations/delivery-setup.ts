import { auditStatement } from '../audit/producer';
import { z } from 'zod';
import type { WorkerBindings } from '../../app/bindings';
import { guardedSql, ownerPredicate, type IntegrationOwner } from './authority';
import { IntegrationError } from './errors';
import { openSecret, sealSecret } from './secrets';
import { ownershipPolicy, type OwnershipPolicy } from '../../../../vendor/base/egress-service/ownership';

export const deliverySetupInput = z.object({
  accountId: z.string().regex(/^[a-f0-9]{32}$/),
  apiToken: z.string().trim().min(20).max(512).regex(/^[A-Za-z0-9_.-]+$/),
}).strict();
const identity = (workspace: string) => 'egress:' + workspace;
const refused = () => new IntegrationError(400, 'delivery_setup_refused', 'Could not read every hosting domain. Check the account ID and give the token Workers Scripts Read and Zone Read access to this account and all its zones.');

async function cloudflare(path: string, token: string) {
  try {
    const response = await fetch('https://api.cloudflare.com/client/v4/' + path, {
      headers: { Authorization: 'Bearer ' + token }, redirect: 'manual', signal: AbortSignal.timeout(15000),
    });
    // Only fixed provider URLs receive the token; provider bodies never enter errors or logs.
    if (!response.ok) { await response.body?.cancel(); throw refused(); }
    const reader = response.body!.getReader();
    let text = '', bytes = 0;
    try {
      const decoder = new TextDecoder();
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 1024 * 1024) throw refused();
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    const value = JSON.parse(text);
    if (value.success !== true || !Array.isArray(value.errors) || value.errors.length) throw refused();
    return value;
  } catch { throw refused(); }
}

export async function configureDelivery(env: WorkerBindings, owner: IntegrationOwner, input: z.infer<typeof deliverySetupInput>) {
  const account = input.accountId;
  const subdomain = await cloudflare(`accounts/${account}/workers/subdomain`, input.apiToken);
  const suffix = subdomain.result?.subdomain + '.workers.dev';
  const zones: string[] = [], ids = new Set<string>();
  let total: number | undefined;
  for (let page = 1; page <= 200; page++) {
    const value = await cloudflare(`zones?account.id=${account}&page=${page}&per_page=50`, input.apiToken);
    const info = value.result_info, rows = value.result;
    if (!Array.isArray(rows) || !info || info.page !== page || info.per_page !== 50 || info.count !== rows.length
      || !Number.isSafeInteger(info.total_count) || info.total_count < 0 || info.total_count > 10000
      || (info.total_pages !== Math.max(1, Math.ceil(info.total_count / 50)) && !(info.total_count === 0 && info.total_pages === 0))) throw refused();
    total ??= info.total_count;
    if (total !== info.total_count || rows.length !== Math.min(50, total! - zones.length)) throw refused();
    for (const row of rows) {
      if (row.account?.id !== account || typeof row.id !== 'string' || ids.has(row.id) || typeof row.name !== 'string') throw refused();
      ids.add(row.id); zones.push(row.name);
    }
    if (zones.length === total) break;
  }
  if (zones.length !== total) throw refused();
  let policy: OwnershipPolicy;
  try { policy = ownershipPolicy(JSON.stringify(zones), suffix); } catch { throw refused(); }
  const host = new URL(env.APP_ORIGIN).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1' && ![policy.workersSuffix, ...policy.zones].some(domain => host === domain || host.endsWith('.' + domain))) {
    throw new IntegrationError(400, 'delivery_account_mismatch', 'Choose the Cloudflare account that hosts this Vector address.');
  }
  const encrypted = await sealSecret(env, identity(owner.workspace), JSON.stringify(policy));
  await guardedSql(env.DB, ownerPredicate(owner)).batch([
    { sql: "INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted", params: [identity(owner.workspace), encrypted] },
    auditStatement({workspace:owner.workspace,actor:owner.id,action:'integration.delivery_configured',subject:owner.workspace}),
  ]);
  return { configured: true };
}

export async function deliveryOwnership(env: WorkerBindings, workspace: string): Promise<OwnershipPolicy | null> {
  const row = await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot='current'").bind(identity(workspace)).first<{encrypted: string}>();
  if (!row) return null;
  try {
    const stored = JSON.parse(await openSecret(env, identity(workspace), row.encrypted));
    return ownershipPolicy(JSON.stringify(stored.zones), stored.workersSuffix);
  } catch { return null; }
}
