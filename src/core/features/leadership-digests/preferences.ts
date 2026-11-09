import { audit } from '../administration/transaction';
import { leadershipChoiceSchema } from './schema';
import { mutationDatabase } from '../auth/mutation-database';
import { settingsActor, SettingsError } from '../settings/repository';
export async function leadershipPreferences(db: D1Database, actor: string) {
  await settingsActor(db, actor);
  const row = await db.prepare('SELECT email_enabled email,slack_enabled slack FROM leadership_digest_preferences WHERE operator_id=?')
    .bind(actor).first<{email: number; slack: number}>();
  const deliveries=(await db.prepare(`SELECT id,channel,status,attempts,updated_at updatedAt FROM leadership_digest_receipts
    WHERE recipient_id=? AND status IN('failed','uncertain') ORDER BY updated_at DESC,id DESC LIMIT 50`).bind(actor).all()).results;
  return {email: Boolean(row?.email), slack: Boolean(row?.slack),deliveries};
}
/** Each person explicitly chooses outbound channels; initiative ownership alone sends nothing. */
export async function saveLeadershipPreferences(db: D1Database, actor: string, input: unknown) {
  const parsed = leadershipChoiceSchema.safeParse(input);
  if (!parsed.success) throw new SettingsError('invalid_request','Choose valid leadership digest channels.',400);
  const access=await settingsActor(db, actor),previous=await leadershipPreferences(db,actor),at=new Date().toISOString();
  db = mutationDatabase(db, actor);
  await db.batch([db.prepare(`INSERT INTO leadership_digest_preferences(operator_id,email_enabled,slack_enabled,revision)
    VALUES(?,?,?,?) ON CONFLICT(operator_id) DO UPDATE SET email_enabled=excluded.email_enabled,
    slack_enabled=excluded.slack_enabled,revision=excluded.revision`)
    .bind(actor,Number(parsed.data.email),Number(parsed.data.slack),crypto.randomUUID()),
    ...audit({db,actor,workspace:access.workspace_id,at},'leadership_digest.channels_changed',actor,'Leadership digest',{email:previous.email,slack:previous.slack},parsed.data)]);
  return leadershipPreferences(db, actor);
}
