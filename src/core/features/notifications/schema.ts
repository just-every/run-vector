/** Client-safe collaboration DTOs. */
export const notificationKinds = [
  "assignment",
  "mention",
  "comment",
  "intake_return",
  "unblocked",
  "due_reminder",
] as const;
export type NotificationKind = (typeof notificationKinds)[number];
export type InboxItem = {
  id: string;
  eventId: string;
  identifier: string;
  title: string;
  actor: string | null;
  causes: NotificationKind[];
  createdAt: string;
  readAt: string | null;
};
export type InboxPage = {
  items: InboxItem[];
  unreadCount: number;
  nextCursor: string | null;
};
export type IssueSubscription = { following: boolean; muted: boolean };
export type NotificationPreferences = {
  emailEnabled: boolean;
  emailAvailable: boolean;
  mutedKinds: NotificationKind[];
  mutedIssues: { identifier: string; title: string }[];
  deliveries: {
    id: string;
    identifier: string;
    title: string;
    status: "failed" | "uncertain";
    reason: string | null;
    attempts: number;
    updatedAt: string;
  }[];
};
