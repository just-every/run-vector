import type { WorkerBindings } from '../../app/bindings';
// @ts-expect-error Base mail is native ESM without declarations.
import { verifyWebhook } from '../../../../vendor/base/mail/index.mjs';
import { openSecret } from '../integrations/secrets';
import { rawIntegrationBody } from '../integrations/raw-body';
import { IntegrationError } from '../integrations/errors';
import { z } from 'zod';

export const eventKeyIdentity = (teamId: string) => `sendgrid-events:${teamId}`;
const eventSchema = z.object({
  event: z.string().min(1).max(64),
  sg_message_id: z.string().min(1).max(512).optional(),
  rer_delivery_id: z.string().min(1).max(128).optional(),
  'smtp-id': z.string().min(1).max(512).optional(),
  email: z.email().max(254),
});

/** The route selects the team, never signed JSON. A signature proves the provider;
 * the persisted provider identity and recipient must independently match one send. */
export async function receiveEmailEvents(env: WorkerBindings, request: Request, teamId: string) {
  const identity = eventKeyIdentity(teamId);
  const credential = await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot='current'")
    .bind(identity).first<{ encrypted: string }>();
  const key = credential && await openSecret(env, identity, credential.encrypted).catch(() => null);
  if (!key) throw new IntegrationError(401, 'email_event_signature_invalid');
  const rawBody = await rawIntegrationBody(request, 1024 * 1024);
  if (!await verifyWebhook({ provider: 'sendgrid', rawBody, headers: request.headers, key, now: Date.now(), toleranceSeconds: 300 }))
    throw new IntegrationError(401, 'email_event_signature_invalid');
  let input: unknown;
  try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)); }
  catch { throw new IntegrationError(400, 'email_event_invalid'); }
  const parsed = z.array(eventSchema).max(1000).safeParse(input);
  if (!parsed.success) throw new IntegrationError(400, 'email_event_invalid');
  const at = new Date().toISOString();
  const statements = parsed.data.filter(event => event.event === 'bounce' || event.event === 'dropped').map(event => {
    // A suffixed provider identity also needs the signed custom delivery ID;
    // no undocumented delimiter or suffix parsing is assumed. Delayed bounces
    // may omit sg_message_id, but can carry our exact outbound Message-ID.
    const matches = `provider_message_id IS NOT NULL AND (
      (? IS NOT NULL AND (?=provider_message_id OR (?=id AND substr(?,1,length(provider_message_id))=provider_message_id)))
      OR (? IS NULL AND ?=message_id))`;
    const correlation = [event.sg_message_id ?? null,event.sg_message_id ?? null,event.rer_delivery_id ?? null,event.sg_message_id ?? null,event.sg_message_id ?? null,event['smtp-id'] ?? null];
    return env.DB.prepare(`UPDATE intake_email_deliveries SET bounced_at=?,updated_at=?
      WHERE ${matches} AND bounced_at IS NULL AND status='accepted'
      AND (SELECT COUNT(*) FROM intake_email_deliveries WHERE ${matches})=1
      AND EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id
        JOIN intake_email_messages m ON m.id=intake_email_deliveries.root_id
        JOIN vector_integration_secret_keys k ON k.identity=? AND k.slot='current' AND k.encrypted=?
        WHERE i.id=intake_email_deliveries.issue_id AND t.id=? AND m.team_id=t.id AND m.status='received'
        AND (m.sender=? OR EXISTS(SELECT 1 FROM json_each(m.cc_json) WHERE value=?)))
      AND NOT EXISTS(SELECT 1 FROM vector_http_restore)
      AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
      AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`)
      .bind(at, at, ...correlation, ...correlation, identity, credential!.encrypted, teamId, event.email, event.email);
  });
  if (statements.length) await env.DB.batch(statements);
  // No content, matching count, mail, notification or activity side effect.
  return { received: true };
}
