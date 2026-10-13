import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentTimestamp } from "../src/core/features/issues/ui/discussion";
import { NamedLinks } from "../src/core/features/links/ui/named-links";
import { EmailUnavailableNotice } from "../src/core/features/notifications/ui/notifications-panel";
import { MentionSuggestionOption } from "../src/core/features/notifications/ui/mention-textarea";
import {
  InboxEmptyState,
  InboxNotificationRow,
} from "../src/core/features/notifications/ui/inbox-page";
import type { InboxItem } from "../src/core/features/notifications/schema";

const now = Date.parse("2026-10-08T10:00:00.000Z");
const notificationsCss = readFileSync(
  new URL(
    "../src/core/features/notifications/ui/notifications.css",
    import.meta.url,
  ),
  "utf8",
);

beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(now));
afterEach(() => vi.restoreAllMocks());

describe("notification, inbox, and discussion presentation", () => {
  it("keeps the existing email-off explanation and adds an operator next step", () => {
    const html = renderToStaticMarkup(<EmailUnavailableNotice />);

    expect(html).toContain(
      "Email notifications are off for this installation. Notification mail needs a configured provider and must be enabled.",
    );
    expect(html).toContain(
      "Ask whoever deployed Vector to enable email notifications.",
    );
    expect(html).toContain(
      'href="https://github.com/just-every/run-vector/blob/main/DEPLOY.md"',
    );
    expect(html).toContain(">deployment guide</a>");
  });

  it("renders the mention suggestion name without its internal operator identity", () => {
    const html = renderToStaticMarkup(
      <MentionSuggestionOption
        operator={{ id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", name: "Maya Ortiz" }}
        optionId="mention-option-0"
        selected
        onChoose={() => {}}
      />,
    );

    expect(html).toContain('role="option" aria-selected="true"');
    expect(html).toContain("Maya Ortiz");
    expect(html).not.toContain("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });

  it("shows comment creation and edit times as relative text with datetime values", () => {
    const html = renderToStaticMarkup(
      <CommentTimestamp
        createdAt="2026-10-08T08:00:00.000Z"
        editedAt="2026-10-08T09:45:00.000Z"
      />,
    );

    expect(html).toContain(
      '<time dateTime="2026-10-08T08:00:00.000Z">2h ago</time>',
    );
    expect(html).toContain("· edited");
    expect(html).toContain(
      '<time dateTime="2026-10-08T09:45:00.000Z">15m ago</time>',
    );
  });

  it("labels comment links separately from issue links", () => {
    const props = {
      identifier: "FLW-840",
      links: [],
      onRefresh: () => {},
    };
    const issueHtml = renderToStaticMarkup(<NamedLinks {...props} />);
    const commentHtml = renderToStaticMarkup(
      <NamedLinks {...props} commentId="comment-1" />,
    );

    expect(issueHtml).toContain(">Attach link</summary>");
    expect(commentHtml).toContain(">Attach link to this comment</summary>");
  });

  it("keeps the exact empty-inbox marker and explains future assignments and mentions", () => {
    const html = renderToStaticMarkup(<InboxEmptyState />);

    expect(html).toContain("<p>Nothing new.</p>");
    expect(html).toContain(
      "You&#x27;re all caught up. Assignments and mentions will appear here.",
    );
  });

  it("uses the app relative-time helper and keeps issue identifiers on one line", () => {
    const item: InboxItem = {
      id: "notification-1",
      eventId: "event-1",
      identifier: "FLW-840",
      title: "Review the customer report",
      actor: "Maya Ortiz",
      causes: ["mention"],
      createdAt: "2026-10-08T08:00:00.000Z",
      readAt: null,
    };
    const html = renderToStaticMarkup(
      <InboxNotificationRow item={item} pending={null} onOpen={() => {}} />,
    );

    expect(html).toContain('dateTime="2026-10-08T08:00:00.000Z">2h ago</time>');
    expect(html).toContain('class="inbox-identifier">FLW-840</strong>');
    expect(html).toContain("Maya Ortiz mentioned you");
    expect(notificationsCss).toMatch(
      /\.inbox-identifier\s*\{\s*white-space:\s*nowrap;\s*\}/,
    );
  });
});
