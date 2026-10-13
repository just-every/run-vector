import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  ApiError,
  createApiResourceController,
  fetchJson,
  isUnavailableResourceError,
  resourceStateForIdentity,
  type ResourceState,
} from "../src/core/app/api-client.ts";

const schema = z.object({ identifier: z.string(), version: z.number() });
type Issue = z.output<typeof schema>;
const loaded: Issue = { identifier: "FLW-843", version: 2 };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function harness(
  initial: ResourceState<Issue> = { data: loaded, error: null, loading: false },
) {
  const calls: Array<
    ReturnType<typeof deferred<Issue>> & { signal: AbortSignal }
  > = [];
  const receipts: ResourceState<Issue>[] = [];
  const controller = createApiResourceController<Issue>(
    (signal) => {
      const response = { ...deferred<Issue>(), signal };
      calls.push(response);
      return response.promise;
    },
    (state) => receipts.push(state),
    initial,
  );
  return { controller, calls, receipts, last: () => receipts.at(-1)! };
}

test("Resource reads retain authorized drafts and recover without stale or cross-identity disclosure", async (context) => {
  // Scenario: "loaded drafts survive transient/network/schema failures, retry retains error until a valid receipt"
  await (async () => {
    for (const failure of [
      new ApiError(500, { message: "Temporary outage" }),
      new TypeError("Network unavailable"),
      new ApiError(429, {}),
      new Error("Invalid read-model receipt"),
    ]) {
      const h = harness(),
        request = h.controller.refresh();
      assert.equal(h.last().data, loaded);
      assert.equal(h.last().loading, false);
      h.calls[0].reject(failure);
      await request;
      assert.equal(h.last().data, loaded);
      assert.equal(h.last().error, failure);
      const retry = h.controller.refresh();
      assert.equal(h.last().error, failure);
      assert.equal(h.last().data, loaded);
      h.calls[1].resolve({ ...loaded, version: 3 });
      await retry;
      assert.deepEqual(h.last(), {
        data: { ...loaded, version: 3 },
        error: null,
        loading: false,
      });
      h.controller.dispose();
    }
  })();
  // Scenario: "denied/deleted resources clear private data; a failed retry cannot resurrect it"
  await (async () => {
    for (const status of [401, 403, 404, 410]) {
      const h = harness(),
        denied = new ApiError(status, {}),
        request = h.controller.refresh();
      h.calls[0].reject(denied);
      await request;
      assert.equal(isUnavailableResourceError(denied), true);
      assert.equal(h.last().data, null);
      assert.equal(h.last().error, denied);
      const retry = h.controller.refresh();
      assert.equal(h.last().data, null);
      assert.equal(h.last().error, denied);
      assert.equal(h.last().loading, true);
      h.calls[1].reject(new TypeError("Offline"));
      await retry;
      assert.equal(h.last().data, null);
      h.controller.dispose();
    }
  })();
  // Scenario: "overlapping polls: newest request wins even when aborted older transport later succeeds or fails"
  await (async () => {
    for (const olderResult of ["success", "denial", "transient"] as const) {
      const h = harness(),
        first = h.controller.refresh(),
        second = h.controller.refresh();
      assert.equal(h.calls[0].signal.aborted, true);
      h.calls[1].resolve({ ...loaded, version: 4 });
      await second;
      const receipt = h.last(),
        count = h.receipts.length;
      if (olderResult === "success")
        h.calls[0].resolve({ ...loaded, version: 1 });
      else
        h.calls[0].reject(
          new ApiError(olderResult === "denial" ? 401 : 500, {}),
        );
      await first;
      assert.equal(h.last(), receipt);
      assert.equal(h.receipts.length, count);
      h.controller.dispose();
    }
    for (const status of [401, 403, 404, 410]) {
      const h = harness(),
        first = h.controller.refresh(),
        second = h.controller.refresh();
      h.calls[1].reject(new ApiError(status, {}));
      await second;
      h.calls[0].resolve(loaded);
      await first;
      assert.equal(h.last().data, null);
      assert.equal((h.last().error as ApiError).status, status);
      h.controller.dispose();
    }
  })();
  // Scenario: "background polls do not starve a slow read; polling resumes after completion and explicit reload still supersedes"
  await (async () => {
    const h = harness(),
      slow = h.controller.refresh();
    const initialCount = h.receipts.length;
    for (let tick = 0; tick < 10; tick++)
      await h.controller.refresh({ skipIfPending: true });
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].signal.aborted, false);
    assert.equal(h.receipts.length, initialCount);
    h.calls[0].resolve({ ...loaded, version: 3 });
    await slow;
    assert.equal(h.last().data?.version, 3);
    const poll = h.controller.refresh({ skipIfPending: true });
    assert.equal(h.calls.length, 2);
    const explicit = h.controller.refresh();
    assert.equal(h.calls.length, 3);
    assert.equal(h.calls[1].signal.aborted, true);
    await h.controller.refresh({ skipIfPending: true });
    assert.equal(h.calls.length, 3);
    h.calls[2].resolve({ ...loaded, version: 5 });
    await explicit;
    h.calls[1].resolve({ ...loaded, version: 4 });
    await poll;
    assert.equal(h.last().data?.version, 5);
    h.controller.dispose();
  })();
  // Scenario: "URL/schema identity invalidates synchronously and disposal blocks late cross-issue receipts"
  await (async () => {
    const h = harness(),
      request = h.controller.refresh();
    const snapshot = { url: "/api/issues/FLW-843", schema, ...h.last() };
    assert.equal(
      resourceStateForIdentity(snapshot, snapshot.url, schema).data,
      loaded,
    );
    const blank = { data: null, error: null, loading: true };
    assert.deepEqual(
      resourceStateForIdentity(snapshot, "/api/issues/FLW-844", schema),
      blank,
    );
    assert.deepEqual(
      resourceStateForIdentity(
        snapshot,
        snapshot.url,
        z.object({ other: z.string() }),
      ),
      blank,
    );
    h.controller.dispose();
    assert.equal(h.calls[0].signal.aborted, true);
    const count = h.receipts.length;
    h.calls[0].resolve({ ...loaded, version: 99 });
    await request;
    await h.controller.refresh();
    assert.equal(h.receipts.length, count);
    assert.equal(h.calls.length, 1);
    const next = harness(
        resourceStateForIdentity(snapshot, "/api/issues/FLW-844", schema),
      ),
      replacement = next.controller.refresh();
    assert.equal(next.last().data, null);
    next.calls[0].resolve({ identifier: "FLW-844", version: 1 });
    await replacement;
    assert.equal(next.last().data?.identifier, "FLW-844");
    next.controller.dispose();
  })();
  // Scenario: "actual fetchJson receipts enforce schema and classify native HTTP denial without exposing cached data"
  await (async () => {
    const originalFetch = globalThis.fetch;
    const responses = [
      new Response(JSON.stringify({ identifier: "FLW-843", version: 3 }), {
        status: 200,
      }),
      new Response(
        JSON.stringify({ identifier: "FLW-843", version: "wrong" }),
        {
          status: 200,
        },
      ),
      new Response(
        JSON.stringify({ message: "A native operator session is required." }),
        { status: 401 },
      ),
    ];
    globalThis.fetch = async () => responses.shift()!;
    const receipts: ResourceState<Issue>[] = [];
    const controller = createApiResourceController(
      (signal) => fetchJson("/api/issues/FLW-843", schema, { signal }),
      (state) => receipts.push(state),
      { data: loaded, error: null, loading: false },
    );
    try {
      await controller.refresh();
      assert.equal(receipts.at(-1)?.data?.version, 3);
      await controller.refresh();
      assert.equal(receipts.at(-1)?.data?.version, 3);
      assert.ok(receipts.at(-1)?.error instanceof z.ZodError);
      await controller.refresh();
      assert.equal(receipts.at(-1)?.data, null);
      assert.ok(receipts.at(-1)?.error instanceof ApiError);
      assert.equal(
        receipts.at(-1)?.error?.message,
        "A native operator session is required.",
      );
    } finally {
      controller.dispose();
      globalThis.fetch = originalFetch;
    }
  })();
});
