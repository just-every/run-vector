import type { WorkerBindings } from '../../app/bindings';
import type { IntegrationOwner } from './authority';
import { guardedSql, ownerPredicate } from './authority';
import { auditStatement } from '../audit/producer';
import { IntegrationError } from './errors';
import type { WebhookSubscription } from './subscription-schema';

/** An empty team selection means all public teams; it never grants private access. */
export function subscriptionGuard(owner: IntegrationOwner, input: WebhookSubscription) {
  return {
    sql: `SELECT CASE WHEN EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND role IN ('owner','admin') AND removed_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM json_each(?) selected WHERE NOT EXISTS(
        SELECT 1 FROM teams t WHERE t.id=selected.value AND t.workspace_id=? AND t.archived_at IS NULL))
      THEN 1 ELSE json('webhook subscription denied') END`,
    params: [owner.id, owner.workspace, JSON.stringify(input.teamIds), owner.workspace],
  };
}

export async function updateSubscriptions(env: WorkerBindings, owner: IntegrationOwner, id: string, input: WebhookSubscription) {
  const at = new Date().toISOString();
  const [rows] = await guardedSql(env.DB, ownerPredicate(owner)).batch([
    { sql: "SELECT id FROM vector_webhook_destinations WHERE id=? AND workspace_id=? AND kind='webhook' AND enabled=1 AND revoked_at IS NULL", params: [id, owner.workspace] },
  ]);
  if (!rows.length) throw new IntegrationError(404, 'destination_unavailable');
  await guardedSql(env.DB, ownerPredicate(owner)).batch([
    subscriptionGuard(owner, input),
    { sql: "SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_webhook_destinations WHERE id=? AND workspace_id=? AND kind='webhook' AND enabled=1 AND revoked_at IS NULL) THEN 1 ELSE json('destination changed') END", params: [id, owner.workspace] },
    { sql: 'UPDATE vector_webhook_destinations SET event_kinds=?,team_ids=?,updated_at=? WHERE id=? AND workspace_id=?', params: [JSON.stringify(input.events), JSON.stringify(input.teamIds), at, id, owner.workspace] },
    auditStatement({ workspace: owner.workspace, actor: owner.id, action: 'integration.destination_subscriptions_changed', subject: id, at }),
  ]);
  return { id, ...input };
}

/** Check the current selection again for durable deliveries, including retries. */
export async function subscribedWebhookEvent(env: WorkerBindings, workspace: string, destination: string, event: string, body: string) {
  const payload = JSON.parse(body) as { identifier?: string; teamId?: string };
  if (event === 'vector.test') return true;
  if (!payload.identifier) return false;
  return !!await env.DB.prepare(`SELECT 1 FROM vector_webhook_destinations d
    JOIN issues i ON i.identifier=? JOIN teams t ON t.id=i.team_id AND t.workspace_id=d.workspace_id
    WHERE d.id=? AND d.workspace_id=? AND d.kind='webhook' AND d.enabled=1 AND d.revoked_at IS NULL AND t.is_private=0
    AND EXISTS(SELECT 1 FROM json_each(d.event_kinds) WHERE value=?)
    AND (json_array_length(d.team_ids)=0 OR EXISTS(SELECT 1 FROM json_each(d.team_ids) WHERE value=t.id))
    AND (? IS NULL OR json_array_length(d.team_ids)=0 OR EXISTS(SELECT 1 FROM json_each(d.team_ids) WHERE value=?))`)
    .bind(payload.identifier, destination, workspace, event, payload.teamId ?? null, payload.teamId ?? null).first();
}
