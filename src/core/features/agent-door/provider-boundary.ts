import type { WorkerBindings } from '../../app/bindings';
import { notificationEmailAvailable } from '../notifications/context';
import { ToolRefusal } from '../../../../vendor/base/agent-door/index.ts';

/** Until Base supplies the native operation identity and key, an agent cannot
 * prepare provider work that would outlive this invocation. The existing human
 * provider path remains authoritative; refusing here creates no outbox intent. */
export function agentProviderFence(env: WorkerBindings, person: string) {
  return {
    sql: `NOT EXISTS(SELECT 1 FROM vector_webhook_destinations d JOIN operators p ON p.workspace_id=d.workspace_id
      WHERE p.id=? AND d.enabled=1)
      AND NOT EXISTS(SELECT 1 FROM vector_slack_installations s JOIN operators p ON p.workspace_id=s.workspace_id
      WHERE p.id=? AND s.enabled=1)
      AND (?=0 OR NOT EXISTS(SELECT 1 FROM operators recipient JOIN operators p ON p.workspace_id=recipient.workspace_id
      WHERE p.id=? AND recipient.id<>p.id AND recipient.removed_at IS NULL))`,
    values: [person, person, Number(notificationEmailAvailable(env)), person],
  };
}

export async function requireAgentProviderBoundary(env: WorkerBindings, person: string) {
  const fence = agentProviderFence(env, person);
  if (!await env.DB.prepare('SELECT (' + fence.sql + ') AS allowed').bind(...fence.values).first<number>('allowed')) {
    throw new ToolRefusal('native_queue_context_required', 'Native provider work requires durable operation identity and idempotency context.');
  }
  return fence;
}
