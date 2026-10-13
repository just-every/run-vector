import { z } from "zod";
import { fetchJson } from "../../../app/api-client.ts";
import { notificationKinds } from "../schema.ts";
import type { InboxPage } from "../schema.ts";
const kind = z.enum(notificationKinds);
export const countSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
});
export function fetchNotificationCount() {
  // Count generations cancel publication, not this small read-only transport.
  // Mutations and access denials can retire a poll while its HTTP read finishes.
  return fetchJson("/api/notifications/count", countSchema);
}
export const subscriptionSchema = z.object({
  following: z.boolean(),
  muted: z.boolean(),
});
export const inboxSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      eventId: z.string(),
      identifier: z.string(),
      title: z.string(),
      actor: z.string().nullable(),
      causes: z.array(kind),
      createdAt: z.string(),
      readAt: z.string().nullable(),
    }),
  ),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
});
export function fetchNotificationInbox(cursor?: string): Promise<InboxPage> {
  // Retiring an Inbox generation suppresses publication while its read-only
  // HTTP request finishes, including ordinary navigation away from Inbox.
  return fetchJson(
    cursor === undefined
      ? "/api/notifications"
      : `/api/notifications?cursor=${encodeURIComponent(cursor)}`,
    inboxSchema,
  );
}
export async function fetchCurrentInboxPage(
  cursor: string,
  signal: AbortSignal,
): Promise<InboxPage | null> {
  if (signal.aborted) return null;
  try {
    const page = await fetchNotificationInbox(cursor);
    return signal.aborted ? null : page;
  } catch (error) {
    if (signal.aborted) return null;
    throw error;
  }
}
export const preferencesSchema = z.object({
  emailEnabled: z.boolean(),
  emailAvailable: z.boolean(),
  mutedKinds: z.array(kind),
  mutedIssues: z.array(z.object({ identifier: z.string(), title: z.string() })),
  deliveries: z.array(
    z.object({
      id: z.string(),
      identifier: z.string(),
      title: z.string(),
      status: z.enum(["failed", "uncertain"]),
      reason: z.string().nullable(),
      attempts: z.number().int().nonnegative(),
      updatedAt: z.string(),
    }),
  ),
});
export const mentionOptionsSchema = z.object({
  operators: z.array(
    z.object({
      id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
      name: z.string().min(1).max(200),
    }),
  ),
});
