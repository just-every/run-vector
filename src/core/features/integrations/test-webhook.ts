import type { WorkerBindings } from '../../app/bindings';
import { createUlid } from '../../shared/ids';
import { guardedSql, ownerPredicate, type IntegrationOwner } from './authority';
import { deliveryConfigured, outboundService } from './outbound';
import { IntegrationError } from './errors';
import { restoredEffectsHeld } from '../data/restore-authority';

export async function sendTestWebhook(env: WorkerBindings, owner: IntegrationOwner, destination: string) {
  if (!await deliveryConfigured(env, owner.workspace)) throw new IntegrationError(400, 'outbound_unconfigured', 'Enable delivery above, then send a test.');
  if (await restoredEffectsHeld(env.DB)) throw new IntegrationError(409, 'delivery_held', 'Review restored access and future effects before sending a test.');
  const id = createUlid(new Date()), at = new Date().toISOString();
  const body = JSON.stringify({ event: 'vector.test', message: 'Vector is connected. This test does not change any issues.', sentAt: at });
  await guardedSql(env.DB, ownerPredicate(owner)).batch([
    { sql: "SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_webhook_destinations WHERE id=? AND workspace_id=? AND enabled=1 AND revoked_at IS NULL) THEN 1 ELSE json('destination unavailable') END", params: [destination, owner.workspace] },
    { sql: 'INSERT INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at) VALUES(?,?,?,?,?,?)', params: [id, owner.workspace, destination, 'vector.test', body, at] },
  ]);
  const service = outboundService(env, owner.workspace);
  await service.enqueue({ id, tenant: owner.workspace, destinationId: destination, event: 'vector.test', protocol: 'webhook', body });
  await env.DB.prepare('UPDATE vector_webhook_events SET enqueued_at=? WHERE id=? AND workspace_id=?').bind(at, id, owner.workspace).run();
  const result = await service.dispatch(id);
  return { deliveryId: id, state: result?.state ?? 'queued' };
}
