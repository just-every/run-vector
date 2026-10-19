import { useViewerTime } from '../../../app/viewer-time';
import { useHydrated } from '../../../app/initial-resources';
import type { InboxItem } from "../schema";
import { relativeTime } from "../../streams/ui/helpers";
import { notificationAction } from "./event-description";

import { InboxSnoozeControls, type SnoozeChoice } from "./inbox-snooze";

export function InboxNotificationRow({
  item,
  pending,
  pendingLabel = "Opening…",
  onOpen,
  snoozed = false,
  onSnooze,
  onReturn,
}: {
  item: InboxItem;
  pending: string | null;
  pendingLabel?: string;
  onOpen: () => void;
  snoozed?: boolean;
  onSnooze?: (choice: SnoozeChoice) => Promise<boolean>;
  onReturn?: () => void;
}) {
  const { formatInstant: followUpTime } = useViewerTime();
  const hydrated = useHydrated();
  return (
    <div className={`inbox-entry${item.readAt ? "" : " is-unread"}`}>
      <button
        type="button"
        className={`inbox-row${item.readAt ? "" : " is-unread"}`}
        disabled={!!pending || !hydrated}
        onClick={onOpen}
      >
        <span className="inbox-read-state">
          {item.readAt ? "Read" : "Unread"}
        </span>
        <span className="inbox-row-copy">
          <span>
            {item.actor ?? "An operator"} {notificationAction(item)}{" "}
            <strong className="inbox-identifier">{item.identifier}</strong>
          </span>
          <span className="inbox-title">{item.title}</span>
          <time dateTime={item.visibleAt ?? item.createdAt}>
            {relativeTime(item.visibleAt ?? item.createdAt)}
          </time>
        </span>
        {pending === item.id && <span role="status">{pendingLabel}</span>}
      </button>
      {(onSnooze || onReturn) && (
        <div className="inbox-row-actions">
          {snoozed ? (
            <>
              <span>
                {item.snoozeOnChange ? (
                  "Snoozed until the issue changes"
                ) : item.snoozedUntil ? (
                  <>
                    Snoozed until{" "}
                    <time dateTime={item.snoozedUntil}>
                      {followUpTime(item.snoozedUntil)}
                    </time>
                  </>
                ) : (
                  "Snoozed"
                )}
              </span>
              <button
                type="button"
                disabled={!!pending || !hydrated}
                onClick={onReturn}
                aria-label={`Return ${item.identifier} notification to Inbox now`}
              >
                Return now
              </button>
            </>
          ) : onSnooze ? (
            <InboxSnoozeControls
              identifier={item.identifier}
              disabled={!!pending || !hydrated}
              onSnooze={onSnooze}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
