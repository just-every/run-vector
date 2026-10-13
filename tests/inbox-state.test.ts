import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, type ResourceState } from "../src/core/app/api-client.ts";
import type {
  InboxItem,
  InboxPage,
} from "../src/core/features/notifications/schema.ts";
import {
  inboxPageFailure,
  visibleInboxItems,
} from "../src/core/features/notifications/ui/inbox-state.ts";
const first: InboxItem = {
  id: "first",
  eventId: "event-first",
  identifier: "WORK-1",
  title: "Current private item",
  actor: "An operator",
  causes: ["mention"],
  createdAt: "2026-10-08T00:00:00Z",
  readAt: null,
};
const older: InboxItem = {
  ...first,
  id: "older",
  eventId: "event-older",
  identifier: "WORK-2",
  title: "Older private item",
};
const loaded: ResourceState<InboxPage> = {
  data: { items: [first], unreadCount: 2, nextCursor: "opaque-page" },
  error: null,
  loading: false,
};
test("BASE-ACCESS-002 paginated unauthorized receipts immediately hide all cached private rows", () => {
  for (const status of [401, 403, 404, 410]) {
    assert.equal(visibleInboxItems(loaded, [older]).length, 2);
    const failure = inboxPageFailure(
      loaded,
      new ApiError(status, { message: "Unavailable" }),
    );
    assert.equal(failure.denied, true);
    assert.equal(failure.state.data, null);
    // Even before cache cleanup runs, render admission fences every older page.
    assert.deepEqual(visibleInboxItems(failure.state, [older]), []);
  }
});
test("BASE-ACCESS-002 transient pagination failure keeps the authorized cached pages available", () => {
  for (const error of [
    new ApiError(500, { message: "Temporary failure" }),
    new TypeError("Offline"),
  ]) {
    const failure = inboxPageFailure(loaded, error);
    assert.equal(failure.denied, false);
    assert.equal(failure.state.data, loaded.data);
    assert.deepEqual(
      visibleInboxItems(failure.state, [older]).map((item) => item.id),
      ["first", "older"],
    );
    assert.equal(failure.state.error, error);
  }
});
