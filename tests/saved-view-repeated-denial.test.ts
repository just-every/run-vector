import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, type ResourceState } from "../src/core/app/api-client.ts";
import { issueListQuerySchema } from "../src/core/features/issues/list-schema.ts";
import type { SavedView } from "../src/core/features/views/schema.ts";
import {
  createSavedViewReceiptScope,
  type SavedViewReceiptScope,
} from "../src/core/features/views/ui/saved-view-admission.ts";
import {
  createSavedViewReceiptController,
  mergeNavigationReceipt,
  mergeSavedViewReceipt,
  navigationAdmission,
} from "../src/core/features/views/ui/saved-view-receipt.ts";

const view: SavedView = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  ownerOperatorId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  name: "Private title",
  isShared: false,
  layout: "board",
  query: issueListQuerySchema.parse({ q: "Private query", priority: "high" }),
};
const other = { ...view, id: "01ARZ3NDEKTSV4RRFFQ69G5FAX", name: "Other" };
type Navigation = { views: SavedView[] };

function resource<T>(
  scope: SavedViewReceiptScope,
  merge: (data: T | null, receipt: SavedView) => T | null,
  admission?: Parameters<typeof createSavedViewReceiptController<T>>[4],
  viewId?: string,
) {
  const calls: Array<{
    signal: AbortSignal;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  }> = [];
  let state: ResourceState<T> = { data: null, error: null, loading: true };
  const controller = createSavedViewReceiptController<T>(
    (signal) =>
      new Promise((resolve, reject) => calls.push({ signal, resolve, reject })),
    (next) => {
      state = next;
    },
    merge,
    state,
    admission,
    { scope, viewId },
  );
  return { calls, controller, last: () => state };
}

function readers() {
  const scope = createSavedViewReceiptScope();
  scope.publish(view, "created");
  scope.publish(other, "created");
  const desktop = resource<Navigation>(
    scope,
    mergeNavigationReceipt,
    navigationAdmission,
  );
  const mobile = resource<Navigation>(
    scope,
    mergeNavigationReceipt,
    navigationAdmission,
  );
  const page = resource<SavedView>(
    scope,
    (_data, receipt) => mergeSavedViewReceipt(view.id, receipt),
    undefined,
    view.id,
  );
  return {
    scope,
    desktop,
    mobile,
    page,
    dispose() {
      desktop.controller.dispose();
      mobile.controller.dispose();
      page.controller.dispose();
      scope.retire();
    },
  };
}
async function delivered() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("Repeated saved-view denial converges without reviving data or retry loops", async (context) => {
  // Scenario: "a repeated list omission retires intervening recovery GETs without a navigation retry loop"
  await (async () => {
    const h = readers();
    try {
      const oldMobile = h.mobile.controller.refresh();
      const oldPage = h.page.controller.refresh();
      const firstOmission = h.desktop.controller.refresh();
      h.desktop.calls[0].resolve({ views: [other] });
      await firstOmission;
      assert.equal(
        h.page.calls.length,
        2,
        "first omission starts a recovery read",
      );
      assert.equal(h.mobile.calls.length, 2);

      // The second list result reconfirms the denial after recovery began.
      h.mobile.calls[1].resolve({ views: [other] });
      await delivered();
      h.mobile.calls[0].resolve({ views: [view, other] });
      h.page.calls[0].resolve(view);
      h.page.calls[1].resolve(view); // a successful transport may ignore abort
      await Promise.all([oldMobile, oldPage]);
      await delivered();
      assert.equal(
        h.page.last().data,
        null,
        "neither private title nor query returns",
      );
      assert.equal(
        h.page.calls[1].signal.aborted,
        true,
        "the intervening recovery is older than the second omission",
      );
      assert.equal(h.scope.publish({ ...view, name: "Late PATCH" }), false);
      assert.deepEqual(h.desktop.last().data?.views, [other]);
      assert.deepEqual(h.mobile.last().data?.views, [other]);
      assert.equal(h.desktop.calls.length, 1);
      assert.equal(
        h.mobile.calls.length,
        2,
        "confirming omission does not bounce reads between navigation mounts",
      );

      const fresh = h.page.controller.refresh();
      const restored = { ...view, name: "Fresh authorized title" };
      h.page.calls.at(-1)!.resolve(restored);
      await fresh;
      assert.equal(h.page.last().data, restored);
      const renamed = { ...restored, name: "Authorized later PATCH" };
      assert.equal(h.scope.publish(renamed), true);
      assert.equal(h.page.last().data, renamed);
      for (const nav of [h.desktop, h.mobile])
        assert.equal(
          nav.last().data?.views.find((record) => record.id === view.id),
          renamed,
        );
    } finally {
      h.dispose();
    }
  })();
  // Scenario: "repeated navigation authorization failures retire intervening recovery without retry ping-pong"
  await (async () => {
    for (const status of [401, 403, 404, 410]) {
      const h = readers();
      try {
        const denied = h.desktop.controller.refresh();
        h.desktop.calls[0].reject(new ApiError(status, {}));
        await denied;
        assert.equal(h.mobile.calls.length, 1);
        const recovery = h.page.controller.refresh();
        h.mobile.calls[0].reject(new ApiError(status, {}));
        await delivered();
        h.page.calls[0].resolve(view);
        await recovery;
        assert.equal(h.page.last().data, null);
        assert.equal(
          h.page.calls[0].signal.aborted,
          true,
          `repeated ${status} retires the older recovery`,
        );
        assert.equal(h.scope.publish(view), false);
        assert.equal(h.desktop.calls.length, 1);
        assert.equal(h.mobile.calls.length, 1);
        assert.equal(
          h.page.calls.length,
          1,
          "authorization denial does not auto-retry a detail",
        );

        const fresh = h.page.controller.refresh();
        h.page.calls[1].resolve(view);
        await fresh;
        assert.equal(h.page.last().data, view);
        assert.equal(
          h.scope.publish({ ...view, name: "New authorized PATCH" }),
          true,
        );
        assert.equal(
          h.scope.publish(other),
          false,
          "recovery remains scoped to the actually read identity",
        );
      } finally {
        h.dispose();
      }
    }
  })();
  // Scenario: "reaffirming the same record denial invalidates recovery while preserving unrelated receipts"
  await (async () => {
    const h = readers();
    try {
      h.scope.deny(view.id, null);
      const older = h.page.calls[0];
      h.scope.deny(view.id, null);
      older.resolve(view);
      await delivered();
      assert.equal(h.page.last().data, null);
      assert.equal(older.signal.aborted, true);
      assert.equal(h.scope.publish(view), false);
      assert.deepEqual(h.desktop.last().data?.views, [other]);
      assert.deepEqual(h.mobile.last().data?.views, [other]);
      assert.equal(h.desktop.calls.length, 1);
      assert.equal(h.mobile.calls.length, 1);
      const updatedOther = { ...other, name: "Other remains available" };
      assert.equal(h.scope.publish(updatedOther), true);
      assert.deepEqual(h.desktop.last().data?.views, [updatedOther]);
      assert.deepEqual(h.mobile.last().data?.views, [updatedOther]);
    } finally {
      h.dispose();
    }
  })();
});
