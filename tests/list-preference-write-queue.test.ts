import assert from "node:assert/strict";
import test from "node:test";
import { createPreferenceWriteQueue } from "../src/core/features/views/ui/preference-write-queue.ts";

test("[VIEW-003] applied preference writes reach the server in user order", async () => {
  const enqueue = createPreferenceWriteQueue();
  const events: string[] = [];
  let finishFirst!: () => void;
  const first = enqueue(
    () =>
      new Promise<void>((resolve) => {
        events.push("first started");
        finishFirst = () => {
          events.push("first finished");
          resolve();
        };
      }),
  );
  const second = enqueue(async () => {
    events.push("second finished");
  });

  await Promise.resolve();
  assert.deepEqual(events, ["first started"]);
  finishFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first started", "first finished", "second finished"]);
});

test("[VIEW-003] a rejected preference write does not block retry or later controls", async () => {
  const enqueue = createPreferenceWriteQueue();
  let laterWrites = 0;
  const failed = enqueue(() => Promise.reject(new Error("offline")));

  await assert.rejects(failed, /offline/);
  await enqueue(async () => {
    laterWrites += 1;
  });
  assert.equal(laterWrites, 1);
});
