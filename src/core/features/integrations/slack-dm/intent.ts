import { slackIntent } from '../../notifications/channel-intents';
export const directDestination = 'slack-dm';
/** The source transaction owns the recipient intent, before its event receipt. */
export function directIntent(db: D1Database,eventId: string) {
  return slackIntent(db,"n.event_id=? AND NOT EXISTS(SELECT 1 FROM notification_events e WHERE e.event_id=n.event_id)",[eventId]);
}
