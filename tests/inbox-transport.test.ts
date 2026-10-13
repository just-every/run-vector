import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  ApiError,
  createApiResourceController,
  type ResourceState,
} from "../src/core/app/api-client.ts";
import type { InboxPage } from "../src/core/features/notifications/schema.ts";
import {
  fetchCurrentInboxPage,
  fetchNotificationInbox,
} from "../src/core/features/notifications/ui/data.ts";
import {
  inboxPageFailure,
  visibleInboxItems,
} from "../src/core/features/notifications/ui/inbox-state.ts";

function page(id: string, nextCursor: string | null = null): InboxPage {
  return {
    items: [
      {
        id,
        eventId: `event-${id}`,
        identifier: "WORK-1",
        title: `Private ${id}`,
        actor: null,
        causes: ["mention"],
        createdAt: "2026-10-08T00:00:00Z",
        readAt: null,
      },
    ],
    unreadCount: 1,
    nextCursor,
  };
}

function transport(t: TestContext) {
  const requests: {
    url: string;
    signal: AbortSignal | null | undefined;
    reply: (body: unknown, status?: number) => void;
    fail: (error: Error) => void;
  }[] = [];
  const failed: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    (url: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          failed.push(url);
          reject(new DOMException("The request was aborted", "AbortError"));
        });
        requests.push({
          url,
          signal: init?.signal,
          reply: (body, status = 200) =>
            resolve(new Response(JSON.stringify(body), { status })),
          fail: reject,
        });
      }),
  );
  return { requests, failed };
}

test("NOTIFY-001 Inbox navigation retires publication while the native HTTP read finishes", async (t) => {
  const { requests, failed } = transport(t);
  const states: ResourceState<InboxPage>[] = [];
  const signals: AbortSignal[] = [];
  const controller = createApiResourceController(
    (signal) => {
      signals.push(signal);
      return fetchNotificationInbox();
    },
    (state) => states.push(state),
  );
  t.after(() => controller.dispose());
  const read = controller.refresh();
  controller.dispose();
  assert.equal(signals[0].aborted, true);
  assert.equal(requests[0].url, "/api/notifications");
  assert.equal(requests[0].signal, undefined);
  const retired = states.length;
  requests[0].reply(page("late"));
  await read;
  await controller.refresh();
  assert.deepEqual(failed, []);
  assert.equal(states.length, retired);
  assert.equal(states.at(-1)?.data, null);
  assert.equal(requests.length, 1);
});

test("NOTIFY-004 a replacement Inbox read wins even when its retired transport finishes later", async (t) => {
  const { requests, failed } = transport(t);
  const states: ResourceState<InboxPage>[] = [];
  const controller = createApiResourceController(
    () => fetchNotificationInbox(),
    (state) => states.push(state),
  );
  t.after(() => controller.dispose());
  const older = controller.refresh();
  const latest = controller.refresh();
  requests[1].reply(page("latest", "next-latest"));
  await latest;
  const published = states.length;
  requests[0].reply(page("retired", "next-retired"));
  await older;
  assert.deepEqual(failed, []);
  assert.equal(states.length, published);
  assert.deepEqual(states.at(-1)?.data, page("latest", "next-latest"));
});

test("BASE-ACCESS-002 current Inbox denials hide every cached page and suppress earlier receipts", async (t) => {
  const { requests, failed } = transport(t);
  for (const status of [401, 403, 404, 410]) {
    const cached = page("cached", "cached-cursor");
    const states: ResourceState<InboxPage>[] = [];
    const controller = createApiResourceController(
      () => fetchNotificationInbox(),
      (state) => states.push(state),
      { data: cached, error: null, loading: false },
    );
    const offset = requests.length;
    const older = controller.refresh();
    const latest = controller.refresh();
    requests[offset + 1].reply({ message: "Unavailable" }, status);
    await latest;
    const denied = states.at(-1)!;
    assert.equal(denied.data, null);
    assert.ok(denied.error instanceof ApiError);
    assert.equal(denied.error.status, status);
    assert.deepEqual(visibleInboxItems(denied, page("older-cache").items), []);
    const published = states.length;
    requests[offset].reply(cached);
    await older;
    assert.equal(states.length, published);
    controller.dispose();
  }
  assert.deepEqual(failed, []);
});

test("NOTIFY-001 transient Inbox refresh failures preserve authorized rows and pagination", async (t) => {
  const { requests, failed } = transport(t);
  for (const offline of [false, true]) {
    const cached = page("current", "authorized-cursor");
    const states: ResourceState<InboxPage>[] = [];
    const controller = createApiResourceController(
      () => fetchNotificationInbox(),
      (state) => states.push(state),
      { data: cached, error: null, loading: false },
    );
    const offset = requests.length;
    const pending = controller.refresh();
    if (offline) requests[offset].fail(new TypeError("Offline"));
    else requests[offset].reply({ message: "Temporary failure" }, 500);
    await pending;
    const state = states.at(-1)!;
    assert.equal(state.data, cached);
    assert.equal(state.data.nextCursor, "authorized-cursor");
    assert.equal(state.loading, false);
    assert.ok(state.error);
    assert.deepEqual(
      visibleInboxItems(state, page("older").items).map(({ id }) => id),
      ["current", "older"],
    );
    controller.dispose();
  }
  assert.deepEqual(failed, []);
});

test("NOTIFY-001 pagination retirement suppresses both successes and failures without HTTP aborts", async (t) => {
  const { requests, failed } = transport(t);
  const outcomes = ["success", "denial", "offline"] as const;
  for (const outcome of outcomes) {
    const logical = new AbortController();
    const offset = requests.length;
    const pending = fetchCurrentInboxPage("older /+?", logical.signal);
    assert.equal(
      requests[offset].url,
      "/api/notifications?cursor=older%20%2F%2B%3F",
    );
    assert.equal(requests[offset].signal, undefined);
    logical.abort();
    if (outcome === "success") requests[offset].reply(page("retired"));
    else if (outcome === "denial")
      requests[offset].reply({ message: "Unavailable" }, 401);
    else requests[offset].fail(new TypeError("Offline"));
    assert.equal(await pending, null);
  }
  const alreadyRetired = new AbortController();
  alreadyRetired.abort();
  assert.equal(
    await fetchCurrentInboxPage("unused", alreadyRetired.signal),
    null,
  );
  assert.equal(requests.length, outcomes.length);
  assert.deepEqual(failed, []);
});

test("NOTIFY-001 current pagination preserves rows and next cursor, and retains transient-error caches", async (t) => {
  const { requests, failed } = transport(t);
  const loaded: ResourceState<InboxPage> = {
    data: page("current", "cursor"),
    error: null,
    loading: false,
  };
  const next = fetchCurrentInboxPage("cursor", new AbortController().signal);
  requests[0].reply(page("older", "next-cursor"));
  assert.deepEqual(await next, page("older", "next-cursor"));
  for (const offline of [false, true]) {
    const offset = requests.length;
    const pending = fetchCurrentInboxPage(
      "cursor",
      new AbortController().signal,
    );
    if (offline) requests[offset].fail(new TypeError("Offline"));
    else requests[offset].reply({ message: "Temporary failure" }, 500);
    await assert.rejects(pending, (error: Error) => {
      const failure = inboxPageFailure(loaded, error);
      assert.equal(failure.denied, false);
      assert.equal(failure.state.data, loaded.data);
      assert.deepEqual(
        visibleInboxItems(failure.state, page("older").items).map(
          ({ id }) => id,
        ),
        ["current", "older"],
      );
      return true;
    });
  }
  for (const status of [401, 403, 404, 410]) {
    const offset = requests.length;
    const pending = fetchCurrentInboxPage(
      "cursor",
      new AbortController().signal,
    );
    requests[offset].reply({ message: "Unavailable" }, status);
    await assert.rejects(pending, (error: Error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      const failure = inboxPageFailure(loaded, error);
      assert.equal(failure.denied, true);
      assert.deepEqual(
        visibleInboxItems(failure.state, page("older").items),
        [],
      );
      return true;
    });
  }
  assert.deepEqual(failed, []);
});
