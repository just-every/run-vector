import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, type ResourceState } from "../src/core/app/api-client.ts";
import { issueListQuerySchema } from "../src/core/features/issues/list-schema.ts";
import type { SavedView } from "../src/core/features/views/schema.ts";
import {
  createSavedViewReceiptController,
  mergeNavigationReceipt,
  navigationAdmission,
} from "../src/core/features/views/ui/saved-view-receipt.ts";

const view: SavedView = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  ownerOperatorId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  name: "Initial private",
  isShared: false,
  layout: "list",
  query: issueListQuerySchema.parse({ priority: "high" }),
};
const other = { ...view, id: "01ARZ3NDEKTSV4RRFFQ69G5FAX", name: "Other" };
type Navigation = { views: SavedView[] };
function harness(data: Navigation | null = { views: [view, other] }) {
  const calls: Array<{
    signal: AbortSignal;
    resolve: (data: Navigation) => void;
    reject: (error: Error) => void;
  }> = [];
  let state: ResourceState<Navigation> = {
    data,
    error: null,
    loading: false,
  };
  const controller = createSavedViewReceiptController<Navigation>(
    (signal) =>
      new Promise((resolve, reject) => calls.push({ signal, resolve, reject })),
    (next) => {
      state = next;
    },
    mergeNavigationReceipt,
    state,
    navigationAdmission,
  );
  return { calls, controller, last: () => state };
}
async function delivered() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("both navigation instances retain authorized omission when an older PATCH arrives", async () => {
  const navigations = [harness(), harness()];
  try {
    for (const h of navigations) {
      const read = h.controller.refresh();
      h.calls[0].resolve({ views: [other] });
      await read;
      h.controller.accept({ ...view, name: "Late private receipt" });
    }
    assert.equal(
      navigations
        .flatMap((h) => h.last().data?.views ?? [])
        .filter((v) => v.id === view.id).length,
      0,
    );
    for (const h of navigations) {
      assert.deepEqual(h.last().data?.views, [other]);
      assert.equal(
        h.calls.length,
        1,
        "rejected receipt cannot initiate another read",
      );
      const retry = h.controller.refresh();
      h.calls[1].reject(new TypeError("Offline"));
      await retry;
      h.controller.accept(view);
      assert.deepEqual(
        h.last().data?.views,
        [other],
        "transient failure does not undo omission",
      );
      const authorized = h.controller.refresh();
      h.calls[2].resolve({ views: [view, other] });
      await authorized;
      const receipt = { ...view, name: "Authorized updated name" };
      h.controller.accept(receipt);
      assert.equal(
        h.last().data?.views.find((v) => v.id === view.id),
        receipt,
      );
      h.calls[3].resolve({ views: [receipt, other] });
      await delivered();
    }
  } finally {
    for (const h of navigations) h.controller.dispose();
  }
});

test("detail denial removes only that view from both navigations and retires GETs started before denial", async () => {
  const navigations = [harness(), harness()];
  try {
    for (const h of navigations) {
      const older = h.controller.refresh();
      h.controller.deny(view.id);
      assert.equal(h.calls[0].signal.aborted, true);
      assert.deepEqual(h.last().data?.views, [other]);
      h.controller.accept({ ...view, name: "Delayed denied PATCH" });
      assert.deepEqual(h.last().data?.views, [other]);
      assert.equal(h.calls.length, 2);
      h.calls[0].resolve({ views: [view, other] }); // ignores abort
      await older;
      assert.deepEqual(h.last().data?.views, [other]);
      h.calls[1].reject(new TypeError("Transient retry failure"));
      await delivered();
      h.controller.accept(view);
      assert.deepEqual(h.last().data?.views, [other]);
      const otherReceipt = { ...other, name: "Unrelated updated view" };
      h.controller.accept(otherReceipt);
      assert.deepEqual(
        h.last().data?.views,
        [otherReceipt],
        "denial is scoped to its view",
      );
      h.calls[2].resolve({ views: [otherReceipt] });
      await delivered();
      h.controller.accept(view);
      assert.deepEqual(
        h.last().data?.views,
        [otherReceipt],
        "successful GET must actually admit the denied ID",
      );
      const authorized = h.controller.refresh();
      h.calls[3].resolve({ views: [view, otherReceipt] });
      await authorized;
      const recovered = { ...view, name: "Recovered authorized receipt" };
      h.controller.accept(recovered);
      assert.equal(
        h.last().data?.views.find((v) => v.id === view.id),
        recovered,
      );
      h.calls[4].resolve({ views: [recovered, otherReceipt] });
      await delivered();
    }
  } finally {
    for (const h of navigations) h.controller.dispose();
  }
});

test("navigation PATCH receipts immediately replace admitted records and retire older GETs", async () => {
  const h = harness();
  try {
    const older = h.controller.refresh();
    const receipt = { ...view, name: "Renamed shared view", isShared: true };
    h.controller.accept(receipt);
    assert.equal(h.calls[0].signal.aborted, true);
    assert.equal(
      h.last().data?.views.find((v) => v.id === view.id),
      receipt,
    );
    h.calls[0].resolve({ views: [view, other] });
    await older;
    assert.equal(
      h.last().data?.views.find((v) => v.id === view.id),
      receipt,
    );
    h.calls[1].reject(new TypeError("Offline"));
    await delivered();
    assert.equal(
      h.last().data?.views.find((v) => v.id === view.id),
      receipt,
    );
  } finally {
    h.controller.dispose();
  }
});

test("navigation-wide authorization denial cannot be unlocked by another detail denial or a late receipt", async () => {
  const h = harness();
  try {
    const read = h.controller.refresh();
    h.calls[0].reject(new ApiError(403, {}));
    await read;
    h.controller.deny(view.id);
    h.calls[1].reject(new TypeError("Offline"));
    await delivered();
    h.controller.accept(other);
    assert.equal(h.last().data, null);
    assert.equal(h.calls.length, 2);
    const authorized = h.controller.refresh();
    h.calls[2].resolve({ views: [other] });
    await authorized;
    h.controller.accept(view);
    assert.deepEqual(h.last().data?.views, [other]);
    const receipt = { ...other, name: "Authorized recovery" };
    h.controller.accept(receipt);
    assert.deepEqual(h.last().data?.views, [receipt]);
    h.calls[3].resolve({ views: [receipt] });
    await delivered();
  } finally {
    h.controller.dispose();
  }
});

test("PATCH during initial navigation load renders immediately and cannot be rolled back by that GET", async () => {
  const h = harness(null);
  try {
    const older = h.controller.refresh();
    const receipt = { ...view, name: "Renamed before navigation loaded" };
    h.controller.accept(receipt);
    assert.deepEqual(h.last().data?.views, [receipt]);
    assert.equal(h.calls[0].signal.aborted, true);
    h.calls[0].resolve({ views: [view, other] });
    await older;
    assert.deepEqual(h.last().data?.views, [receipt]);
    h.calls[1].resolve({ views: [receipt, other] });
    await delivered();
    assert.deepEqual(h.last().data?.views, [receipt, other]);
  } finally {
    h.controller.dispose();
  }
});

test("detail denial before navigation loads blocks its receipt through errors and allows only fresh admission", async () => {
  const h = harness(null);
  try {
    const older = h.controller.refresh();
    h.controller.deny(view.id);
    h.calls[0].resolve({ views: [view, other] });
    await older;
    h.calls[1].reject(new TypeError("Offline"));
    await delivered();
    h.controller.accept(view);
    assert.equal(h.last().data, null);
    h.controller.accept(other);
    assert.deepEqual(
      h.last().data?.views,
      [other],
      "another view is not denied",
    );
    h.calls[2].resolve({ views: [other] });
    await delivered();
    h.controller.accept(view);
    assert.deepEqual(h.last().data?.views, [other]);
    const authorized = h.controller.refresh();
    h.calls[3].resolve({ views: [view, other] });
    await authorized;
    const receipt = { ...view, name: "New authorized edit" };
    h.controller.accept(receipt);
    assert.equal(
      h.last().data?.views.find((v) => v.id === view.id),
      receipt,
    );
    h.calls[4].resolve({ views: [receipt, other] });
    await delivered();
  } finally {
    h.controller.dispose();
  }
});
