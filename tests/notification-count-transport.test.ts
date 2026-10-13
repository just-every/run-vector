import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { ApiError, type ResourceState } from "../src/core/app/api-client.ts";
import { createNotificationCountController } from "../src/core/features/notifications/ui/count-controller.ts";
import { fetchNotificationCount } from "../src/core/features/notifications/ui/data.ts";

function countTransport(t: TestContext) {
  const requests: {
    signal: AbortSignal | null | undefined;
    reply: (body: unknown, status?: number) => void;
  }[] = [];
  const failed: string[] = [];
  t.mock.method(globalThis, "fetch", (url: string, init?: RequestInit) => {
    assert.equal(url, "/api/notifications/count");
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener("abort", () => {
        failed.push("aborted");
        reject(new DOMException("The request was aborted", "AbortError"));
      });
      requests.push({
        signal,
        reply: (body, status = 200) =>
          resolve(new Response(JSON.stringify(body), { status })),
      });
    });
  });
  const states: ResourceState<{ unreadCount: number }>[] = [];
  const controller = createNotificationCountController(
    fetchNotificationCount,
    (state) => states.push(state),
  );
  t.after(() => controller.dispose());
  return { controller, requests, failed, states };
}

test("NOTIFY-004 mutation retirement and acceptance let overlapping count transports finish quietly", async (t) => {
  const { controller, requests, failed, states } = countTransport(t);
  controller.accept(10);
  const beforeMutation = controller.refresh();
  controller.invalidate();
  const duringMutation = controller.refresh();
  controller.accept(0);
  const accepted = states.length;

  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ signal }) => signal === undefined));
  requests[1].reply({ unreadCount: 7 });
  requests[0].reply({ unreadCount: 10 });
  await Promise.all([beforeMutation, duringMutation]);
  assert.deepEqual(failed, []);
  assert.equal(states.length, accepted);
  assert.deepEqual(states.at(-1), {
    data: { unreadCount: 0 },
    error: null,
    loading: false,
  });

  const fresh = controller.refresh();
  await controller.refresh();
  assert.equal(requests.length, 3);
  requests[2].reply({ unreadCount: 1 });
  await fresh;
  assert.equal(states.at(-1)?.data?.unreadCount, 1);
});

test("BASE-ACCESS-002 an Inbox denial clears count immediately while retired transports settle", async (t) => {
  const { controller, requests, failed, states } = countTransport(t);
  controller.accept(5);
  const older = controller.refresh();
  controller.invalidate();
  const newer = controller.refresh();
  const denied = new ApiError(401, { message: "Session revoked" });
  controller.deny(denied);
  assert.deepEqual(states.at(-1), {
    data: null,
    error: denied,
    loading: false,
  });
  const afterDenial = states.length;
  requests[0].reply({ unreadCount: 5 });
  requests[1].reply({ message: "Read failed" }, 500);
  await Promise.all([older, newer]);
  assert.deepEqual(failed, []);
  assert.equal(states.length, afterDenial);
  assert.equal(states.at(-1)?.data, null);
  assert.equal(states.at(-1)?.error, denied);
});

test("BASE-ACCESS-002 a native count 401 clears cached data and older successful reads cannot restore it", async (t) => {
  const { controller, requests, failed, states } = countTransport(t);
  controller.accept(5);
  const older = controller.refresh();
  controller.invalidate();
  const current = controller.refresh();
  requests[1].reply({ message: "Session revoked" }, 401);
  await current;
  assert.equal(states.at(-1)?.data, null);
  assert.equal(states.at(-1)?.loading, false);
  const error = states.at(-1)?.error;
  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 401);
  const afterDenial = states.length;
  requests[0].reply({ unreadCount: 5 });
  await older;
  assert.deepEqual(failed, []);
  assert.equal(states.length, afterDenial);
  assert.equal(states.at(-1)?.error, error);
});

test("NOTIFY-001 disposal suppresses every outstanding count transport and subsequent refresh", async (t) => {
  const { controller, requests, failed, states } = countTransport(t);
  const older = controller.refresh();
  controller.invalidate();
  const current = controller.refresh();
  controller.dispose();
  const disposed = states.length;
  requests[0].reply({ unreadCount: 8 });
  requests[1].reply({ message: "Session revoked" }, 401);
  await Promise.all([older, current]);
  controller.accept(10);
  controller.invalidate();
  controller.deny(new Error("Late denial"));
  await controller.refresh();
  assert.deepEqual(failed, []);
  assert.equal(states.length, disposed);
  assert.equal(requests.length, 2);
});
