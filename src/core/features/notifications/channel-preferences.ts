import { mutationDatabase } from '../auth/mutation-database';
import { SettingsError, settingsActor } from '../settings/repository';
import { notificationKinds } from './schema';
import { channelDefaultsInputSchema, channelPreferencesInputSchema, type ChannelChoice, type ChannelPreferences } from './channel-schema';
import { effectiveEmailSql, effectiveSlackSql } from './channel-sql';

const builtIn = (kind: ChannelChoice['kind']): ChannelChoice => ({kind,
  emailMode: kind === 'assignment' || kind === 'mention' ? 'immediate' : 'off', slack: false});
export async function channelDefaults(db: D1Database, actor: string) {
  const access = await settingsActor(db, actor);
  const rows = (await db.prepare(`SELECT kind,email_mode emailMode,slack_enabled slack
    FROM notification_channel_defaults WHERE workspace_id=?`).bind(access.workspace_id).all<ChannelChoice>()).results;
  return {channels: notificationKinds.map(kind => {
    const saved = rows.find(row => row.kind === kind);
    return saved ? {...saved, slack: Boolean(saved.slack)} : builtIn(kind);
  })};
}
export async function channelPreferences(db: D1Database, actor: string): Promise<ChannelPreferences> {
  const access = await settingsActor(db, actor);
  const rows = (await db.prepare(`SELECT cause.value kind,${effectiveEmailSql("cause.value", "o.id", "o.workspace_id")} emailMode,${effectiveSlackSql("cause.value", "o.id", "o.workspace_id")} slack,
    NOT EXISTS(SELECT 1 FROM notification_channel_overrides p WHERE p.operator_id=o.id AND p.kind=cause.value) inherited
    FROM operators o JOIN workspace_settings t ON t.id=o.workspace_id,
    json_each(?) cause WHERE o.id=?`).bind(JSON.stringify(notificationKinds), actor)
    .all<ChannelChoice & {inherited: number}>()).results;
  const digestDeliveries = (await db.prepare(`SELECT id,status,attempts,updated_at updatedAt,reason
    FROM notification_digest_batches WHERE recipient_id=? AND status IN ('failed','uncertain')
    ORDER BY updated_at DESC,id DESC LIMIT 50`).bind(actor).all<ChannelPreferences['digestDeliveries'][number]>()).results;
  return {channels: rows.map(row => ({...row,slack: Boolean(row.slack),inherited: Boolean(row.inherited)})),
    defaults: (await channelDefaults(db, actor)).channels,
    canManageDefaults: access.role === 'owner' || access.role === 'admin', digestDeliveries};
}
export async function saveChannelPreferences(db: D1Database, actor: string, input: unknown) {
  const parsed = channelPreferencesInputSchema.safeParse(input);
  if (!parsed.success) throw new SettingsError('invalid_request','Choose valid notification channels.',400);
  await settingsActor(db, actor);
  db = mutationDatabase(db, actor);
  const writes = parsed.data.channels.map(row => 'inherit' in row
    ? db.prepare('DELETE FROM notification_channel_overrides WHERE operator_id=? AND kind=?').bind(actor,row.kind)
    : db.prepare(`INSERT INTO notification_channel_overrides(operator_id,kind,email_mode,slack_enabled)
      VALUES(?,?,?,?) ON CONFLICT(operator_id,kind) DO UPDATE SET email_mode=excluded.email_mode,slack_enabled=excluded.slack_enabled`)
      .bind(actor,row.kind,row.emailMode,Number(row.slack)));
  if (writes.length) await db.batch(writes);
  return channelPreferences(db,actor);
}
export async function saveChannelDefaults(db: D1Database, actor: string, input: unknown) {
  const parsed = channelDefaultsInputSchema.safeParse(input);
  if (!parsed.success) throw new SettingsError('invalid_request','Choose valid notification defaults.',400);
  const access = await settingsActor(db,actor);
  if (!['owner','admin'].includes(access.role)) throw new SettingsError('forbidden','Only Owners and Admins can change notification defaults.',403);
  db = mutationDatabase(db,actor);
  if (parsed.data.channels.length) await db.batch([
    db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM operators WHERE id=? AND role IN ('owner','admin') AND removed_at IS NULL)
      THEN 1 ELSE json('notification defaults denied') END`).bind(actor),
    ...parsed.data.channels.map(row => db.prepare(`INSERT INTO notification_channel_defaults(workspace_id,kind,email_mode,slack_enabled)
      VALUES(?,?,?,?) ON CONFLICT(workspace_id,kind) DO UPDATE SET email_mode=excluded.email_mode,slack_enabled=excluded.slack_enabled`)
      .bind(access.workspace_id,row.kind,row.emailMode,Number(row.slack))),
  ]);
  return channelDefaults(db,actor);
}
