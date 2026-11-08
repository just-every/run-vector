import { digestRecipient, effectsAllowed } from '../notifications/digest-repository';
import { initiativeSubscriptions } from '../subscriptions/repository';
export { effectsAllowed };
export type LeadershipChannel = 'email'|'slack';
export async function leadershipRecipient(db: D1Database, id: string, channel: LeadershipChannel) {
  const clock = await digestRecipient(db,id);
  if (!clock) return null;
  const row = await db.prepare(`SELECT o.email,p.revision,l.slack_user_id slackUserId FROM operators o
    JOIN leadership_digest_preferences p ON p.operator_id=o.id
    LEFT JOIN vector_slack_member_links l ON l.operator_id=o.id AND l.workspace_id=o.workspace_id
    WHERE o.id=? AND o.role<>'guest' AND ${effectsAllowed}
    AND p.${channel === 'email' ? 'email_enabled' : 'slack_enabled'}=1
    ${channel === 'email' ? `AND COALESCE((SELECT email_enabled FROM notification_preferences WHERE operator_id=o.id),1)=1` : ''}
    ${channel === 'slack' ? `AND l.slack_user_id IS NOT NULL AND EXISTS(SELECT 1 FROM vector_slack_installations s WHERE s.workspace_id=o.workspace_id AND s.enabled=1 AND s.slack_team_id=l.slack_team_id)` : ''}`)
    .bind(id).first<{email: string; revision: string; slackUserId: string|null}>();
  return row ? {...clock,...row} : null;
}
/** Unioning source identities deduplicates initiative owners who also subscribe. */
export async function recipientInitiatives(db: D1Database, actor: string, workspace: string) {
  const subscribed = await initiativeSubscriptions(db,actor,workspace);
  return (await db.prepare(`SELECT id,name,status,target_date targetDate FROM initiatives
    WHERE workspace_id=? AND (owner_operator_id=? OR id IN(SELECT value FROM json_each(?))) ORDER BY name,id`)
    .bind(workspace,actor,JSON.stringify(subscribed)).all<{id: string; name: string; status: string; targetDate: string|null}>()).results;
}
