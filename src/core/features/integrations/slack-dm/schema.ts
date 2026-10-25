import {z} from 'zod';
import {notificationKinds} from '../../notifications/schema';
/** Every implemented Inbox event can be routed to a confirmed Slack account. */
export const directKinds=notificationKinds;
export type DirectKind=typeof directKinds[number];
export const slackDirectPreferences=z.object({
 available:z.boolean(),
 reason:z.string().nullable(),
 actionsEnabled:z.boolean(),
 email:z.string(),
 link:z.object({slackTeamId:z.string(),slackUserId:z.string(),name:z.string(),teamName:z.string(),linkedAt:z.string(),kinds:z.array(z.enum(directKinds))}).nullable(),
 deliveries:z.array(z.object({id:z.string(),identifier:z.string(),title:z.string(),state:z.enum(['rejected','uncertain']),reason:z.string(),attempts:z.number().int().nonnegative()})),
});
export type SlackDirectPreferences=z.infer<typeof slackDirectPreferences>;
export const slackLookup=z.object({match:z.object({slackUserId:z.string(),name:z.string(),realName:z.string().nullable(),teamName:z.string()}).nullable(),message:z.string().nullable()});
export type SlackLookup=z.infer<typeof slackLookup>;
