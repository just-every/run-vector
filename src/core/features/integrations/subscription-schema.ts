import { z } from 'zod';

/** Implemented destination event kinds, shared by the configuration routes and Settings. */
export const webhookEvents = ['issue.created', 'issue.updated', 'issue.completed', 'comment.created', 'comment.updated', 'comment.deleted'] as const;
export type WebhookEvent = typeof webhookEvents[number];
/** Registration without a selection, and every upgraded destination, keeps these issue events. */
export const legacyWebhookEvents = ['issue.created', 'issue.updated', 'issue.completed'] as const;
export const webhookEventLabels: Record<WebhookEvent, string> = {
  'issue.created': 'Issue created', 'issue.updated': 'Issue updated', 'issue.completed': 'Issue completed',
  'comment.created': 'Comment created', 'comment.updated': 'Comment edited', 'comment.deleted': 'Comment deleted',
};
export const subscriptionInput = z.object({
  events: z.array(z.enum(webhookEvents)).min(1).max(webhookEvents.length).refine(values => new Set(values).size === values.length),
  teamIds: z.array(z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/)).max(100).refine(values => new Set(values).size === values.length),
}).strict();
export type WebhookSubscription = z.infer<typeof subscriptionInput>;
