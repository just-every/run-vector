import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationCountController } from "../src/core/features/notifications/ui/count-controller.ts";
import type { ResourceState } from "../src/core/app/api-client.ts";

test("BASE-ACCESS-002 denial retires count reads without aborting or restoring private data", async () => {
  const pending: {
    signal: AbortSignal;
    resolve: (count: { unreadCount: number }) => void;
  }[] = [];
  const states: ResourceState<{ unreadCount: number }>[] = [];
  const controller = createNotificationCountController(
    (signal) =>
      new Promise((resolve) => {
        pending.push({ signal, resolve });
      }),
    (state) => states.push(state),
  );

  controller.accept(5);
  const first = controller.refresh();
  const denied = new Error("Session revoked");
  controller.deny(denied);
  assert.deepEqual(states.at(-1), {
    data: null,
    error: denied,
    loading: false,
  });
  assert.equal(pending[0].signal.aborted, false);
  const afterDenial = states.length;
  pending[0].resolve({ unreadCount: 5 });
  await first;
  assert.equal(pending[0].signal.aborted, false);
  assert.equal(states.length, afterDenial);

  const second = controller.refresh();
  assert.equal(states.at(-1)?.data, null);
  assert.equal(states.at(-1)?.error, denied);
  const deniedAgain = new Error("Access still denied");
  controller.deny(deniedAgain);
  assert.deepEqual(states.at(-1), {
    data: null,
    error: deniedAgain,
    loading: false,
  });
  assert.equal(pending[1].signal.aborted, false);

  const third = controller.refresh();
  controller.dispose();
  assert.equal(pending[2].signal.aborted, true);
  assert.equal(pending[1].signal.aborted, false);
  const afterDisposal = states.length;
  pending[1].resolve({ unreadCount: 8 });
  pending[2].resolve({ unreadCount: 9 });
  await Promise.all([second, third]);
  controller.deny(new Error("Denied after disposal"));
  await controller.refresh();
  assert.equal(pending.length, 3);
  assert.equal(states.length, afterDisposal);
  assert.equal(states.at(-1)?.data, null);
  assert.equal(states.at(-1)?.error, deniedAgain);
});
