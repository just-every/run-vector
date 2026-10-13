import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiError,
  resourceStateForIdentity,
  type ResourceState,
} from "../src/core/app/api-client.ts";
import type { SavedView } from "../src/core/features/views/schema.ts";
import {
  createSavedViewReceiptController,
  mergeSavedViewReceipt,
} from "../src/core/features/views/ui/saved-view-receipt.ts";
import { issueListQuerySchema } from "../src/core/features/issues/list-schema.ts";
const view: SavedView = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  ownerOperatorId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  name: "Initial private",
  isShared: false,
  layout: "list",
  query: issueListQuerySchema.parse({ priority: "high" }),
};
function deferred<T>() {
  let resolve!: (data: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function harness() {
  const calls: Array<
    ReturnType<typeof deferred<SavedView>> & { signal: AbortSignal }
  > = [];
  let state: ResourceState<SavedView> = {
    data: view,
    error: null,
    loading: false,
  };
  const controller = createSavedViewReceiptController<SavedView>(
    (signal) => {
      const call = { ...deferred<SavedView>(), signal };
      calls.push(call);
      return call.promise;
    },
    (next) => {
      state = next;
    },
    (_data, receipt) => mergeSavedViewReceipt(view.id, receipt),
    state,
  );
  return { calls, controller, last: () => state };
}
async function delivered() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("PATCH receipt renders immediately; an aborted old GET cannot roll it back, while later fresh reads can change it", async () => {
  const h = harness();
  const older = h.controller.refresh();
  const receipt = {
    ...view,
    name: "Renamed",
    isShared: true,
    layout: "board" as const,
    query: { ...view.query, priority: "urgent" as const },
  };
  h.controller.accept(receipt);
  assert.equal(h.last().data, receipt);
  assert.equal(h.calls[0].signal.aborted, true);
  assert.equal(h.calls.length, 2);
  h.calls[0].resolve(view); // transport ignores abort
  await older;
  assert.equal(h.last().data, receipt);
  h.calls[1].resolve(receipt);
  await delivered();
  const fresh = h.controller.refresh();
  const changed = { ...receipt, name: "Later server change", isShared: false };
  h.calls[2].resolve(changed);
  await fresh;
  assert.equal(h.last().data, changed);
  h.controller.dispose();
});

test("a second PATCH supersedes both earlier receipt and pending read", async () => {
  const h = harness();
  const first = { ...view, name: "First" },
    second = { ...view, name: "Second" };
  h.controller.accept(first);
  h.controller.accept(second);
  h.calls[0].resolve(first);
  await delivered();
  assert.equal(h.last().data, second);
  h.calls[1].resolve(second);
  await delivered();
  assert.equal(h.last().data, second);
  h.controller.dispose();
});

test("401, 403, 404 and 410 clear receipt with its private query; retries and older reads cannot restore it", async () => {
  for (const status of [401, 403, 404, 410]) {
    const h = harness();
    const old = h.controller.refresh();
    h.controller.accept({ ...view, name: "Private receipt" });
    h.calls[1].reject(new ApiError(status, {}));
    await delivered();
    assert.equal(h.last().data, null);
    assert.equal((h.last().error as ApiError).status, status);
    h.calls[0].resolve(view);
    await old;
    assert.equal(h.last().data, null);
    const retry = h.controller.refresh();
    h.calls[2].reject(new TypeError("Offline"));
    await retry;
    assert.equal(h.last().data, null);
    h.controller.dispose();
  }
});

test("view identity scopes receipts and synchronously clears former view during navigation", () => {
  const h = harness();
  h.controller.accept({
    ...view,
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    name: "Different private view",
  });
  assert.equal(h.last().data, view);
  assert.equal(h.calls.length, 0);
  const snapshot = {
    ...h.last(),
    url: `/api/views/${view.id}`,
    schema: issueListQuerySchema,
  };
  assert.deepEqual(
    resourceStateForIdentity(
      snapshot,
      "/api/views/01ARZ3NDEKTSV4RRFFQ69G5FAX",
      issueListQuerySchema,
    ),
    { data: null, error: null, loading: true },
  );
  h.controller.dispose();
});


test("a deferred PATCH finishing after denial cannot resurrect data, and a successful fresh GET restores authority", async () => {
  for (const status of [401, 403, 404, 410]) {
    const h = harness();
    const patch = deferred<SavedView>();
    const mutation = patch.promise.then(receipt => h.controller.accept(receipt));
    const read = h.controller.refresh();
    h.calls[0].reject(new ApiError(status, {}));
    await read;
    patch.resolve({ ...view, name: "Delayed private PATCH receipt" });
    await mutation;
    assert.equal(h.last().data, null);
    assert.equal((h.last().error as ApiError).status, status);
    assert.equal(h.calls.length, 1, "known denial cannot start a receipt-driven reload");
    const retry = h.controller.refresh();
    h.calls[1].reject(new TypeError("Offline after denial"));
    await retry;
    h.controller.accept({ ...view, name: "Another delayed receipt" });
    assert.equal(h.last().data, null, "transient retry cannot unlock receipt retention");
    const authorized = h.controller.refresh();
    const restored = { ...view, name: "Fresh authorized server read" };
    h.calls[2].resolve(restored);
    await authorized;
    assert.equal(h.last().data, restored, "successful GET replaces denial normally");
    const later = { ...restored, name: "Later authorized PATCH" };
    h.controller.accept(later);
    assert.equal(h.last().data, later);
    h.calls[3].resolve(later);
    await delivered();
    h.controller.dispose();
  }
});
