import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationCountController } from "../src/core/features/notifications/ui/count-controller.ts";
import type { ResourceState } from "../src/core/app/api-client.ts";
test("NOTIFY-004 older polls cannot restore the count after a read mutation", async () => {
  let resolve!: (count: { unreadCount: number }) => void;
  let signal!: AbortSignal;
  const states: ResourceState<{ unreadCount: number }>[] = [];
  const controller = createNotificationCountController(
    (abort) => {
      signal = abort;
      return new Promise((yes) => {
        resolve = yes;
      });
    },
    (state) => states.push(state),
  );
  const request = controller.refresh();
  controller.accept(0);
  assert.equal(signal.aborted, true);
  resolve({ unreadCount: 10 });
  await request;
  assert.equal(states.at(-1)?.data?.unreadCount, 0);
  controller.dispose();
});
test("NOTIFY-001 polling skips overlap and disposal ignores even uncancellable responses", async () => {
  let resolve!: (count: { unreadCount: number }) => void;
  let calls = 0;
  const states: ResourceState<{ unreadCount: number }>[] = [];
  const controller = createNotificationCountController(
    () => {
      calls++;
      return new Promise((yes) => {
        resolve = yes;
      });
    },
    (state) => states.push(state),
  );
  const first = controller.refresh();
  await controller.refresh();
  assert.equal(calls, 1);
  controller.dispose();
  const before = states.length;
  resolve({ unreadCount: 5 });
  await first;
  assert.equal(states.length, before);
});

test("NOTIFY-004 next polling request retains the acknowledged count until its receipt", async () => {
  let resolve!: (count: { unreadCount: number }) => void;
  const states: ResourceState<{ unreadCount: number }>[] = [];
  const controller = createNotificationCountController(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
    (state) => states.push(state),
  );
  controller.accept(2);
  const request = controller.refresh();
  assert.equal(states.at(-1)?.data?.unreadCount, 2);
  resolve({ unreadCount: 3 });
  await request;
  assert.equal(states.at(-1)?.data?.unreadCount, 3);
  controller.dispose();
});

test("BASE-ACCESS-002 denied pagination clears the count and aborts older uncancellable polls", async () => {
  let resolve!: (count: { unreadCount: number }) => void;
  const states: ResourceState<{ unreadCount: number }>[] = [];
  const controller = createNotificationCountController(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
    (state) => states.push(state),
  );
  controller.accept(5);
  const request = controller.refresh();
  const denied = new Error("Session revoked");
  controller.deny(denied);
  resolve({ unreadCount: 5 });
  await request;
  assert.equal(states.at(-1)?.data, null);
  assert.equal(states.at(-1)?.error, denied);
  controller.dispose();
});
