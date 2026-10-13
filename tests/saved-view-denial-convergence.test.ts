import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, type ResourceState } from "../src/core/app/api-client.ts";
import { issueListQuerySchema } from "../src/core/features/issues/list-schema.ts";
import type { SavedView } from "../src/core/features/views/schema.ts";
import { createSavedViewReceiptScope } from "../src/core/features/views/ui/saved-view-admission.ts";
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
type Navigation = { views: SavedView[] };
type Request = {
  reader: string;
  signal: AbortSignal;
  settled: boolean;
  reply: (record: SavedView | null) => void;
};
const delivered = () => new Promise<void>((resolve) => setImmediate(resolve));

function harness(status: number) {
  const scope = createSavedViewReceiptScope();
  scope.publish(view, "created");
  const requests: Request[] = [];
  function resource<T>(
    name: string,
    merge: (data: T | null, receipt: SavedView) => T | null,
    value: (record: SavedView) => T,
    admission?: Parameters<typeof createSavedViewReceiptController<T>>[4],
    viewId?: string,
  ) {
    let state: ResourceState<T> = { data: null, error: null, loading: true };
    const controller = createSavedViewReceiptController<T>(
      (signal) =>
        new Promise((resolve, reject) => {
          const request: Request = {
            reader: name,
            signal,
            settled: false,
            reply(record) {
              request.settled = true;
              if (record) resolve(value(record));
              else if (admission) resolve({ views: [] } as T);
              else reject(new ApiError(status, {}));
            },
          };
          requests.push(request);
        }),
      (next) => {
        state = next;
      },
      merge,
      state,
      admission,
      { scope, viewId },
    );
    return { controller, last: () => state };
  }
  const navigation = (name: string) =>
    resource<Navigation>(
      name,
      mergeNavigationReceipt,
      (record) => ({ views: [record] }),
      navigationAdmission,
    );
  const desktop = navigation("desktop");
  const mobile = navigation("mobile");
  const page = resource<SavedView>(
    "detail",
    (_data, receipt) => mergeSavedViewReceipt(view.id, receipt),
    (record) => record,
    undefined,
    view.id,
  );
  const readers = [desktop, mobile, page];
  return {
    scope,
    desktop,
    mobile,
    page,
    requests,
    start() {
      for (const reader of readers) void reader.controller.refresh();
    },
    counts: () =>
      Object.fromEntries(
        ["desktop", "mobile", "detail"].map((name) => [
          name,
          requests.filter((request) => request.reader === name).length,
        ]),
      ),
    async drain(record: SavedView | null = null) {
      // Deliver actual controller requests, including transports that ignore
      // abort. The cap proves a regression without letting a retry loop run.
      for (let deliveries = 0; deliveries < 24; deliveries++) {
        const request = requests.find((candidate) => !candidate.settled);
        if (!request) break;
        request.reply(record);
        await delivered();
      }
      return requests.filter((request) => !request.settled).length;
    },
    async dispose() {
      for (const reader of readers) reader.controller.dispose();
      scope.retire();
      for (const request of requests) if (!request.settled) request.reply(null);
      await delivered();
    },
  };
}

test("Fresh saved-view denials retire earlier recovery reads across every reader", async (context) => {
  for (const status of [403, 404, 410]) {
    // Scenario: `two navigation readers and a ${status} detail converge after authoritative omissions without a poll`
    await (async (t: typeof context) => {
      const h = harness(status);
      try {
        h.start();
        const pending = await h.drain();
        t.diagnostic(`requests without a poll: ${JSON.stringify(h.counts())}`);
        assert.equal(pending, 0, "all automatic revalidation must settle");
        assert.ok(
          h.requests.length <= 8,
          "denial must not manufacture authority transitions",
        );
        assert.deepEqual(h.desktop.last().data?.views, []);
        assert.deepEqual(h.mobile.last().data?.views, []);
        assert.equal(h.page.last().data, null);
        assert.equal((h.page.last().error as ApiError).status, status);
        assert.equal(h.page.last().loading, false);
        assert.equal(h.scope.publish({ ...view, name: "Older PATCH" }), false);
        const settledCounts = h.counts();
        await delivered();
        await delivered();
        assert.deepEqual(h.counts(), settledCounts);
      } finally {
        await h.dispose();
      }
    })(context);
  }
  // Scenario: "repeated fresh denial errors retire recovery and update diagnostics without retries; fresh authorized reads still recover"
  await (async () => {
    const h = harness(404);
    try {
      h.start();
      assert.equal(await h.drain(), 0);
      const navigationCounts = h.counts();
      const olderRead = h.page.controller.refresh();
      const older = h.requests.at(-1)!;
      const latestError = new ApiError(410, {
        message: "This view was deleted.",
      });
      h.scope.deny(view.id, latestError);
      assert.equal(older.signal.aborted, true);
      assert.equal(h.page.last().error, latestError);
      assert.equal(h.page.last().data, null);
      assert.equal(h.counts().desktop, navigationCounts.desktop);
      assert.equal(h.counts().mobile, navigationCounts.mobile);
      older.reply(view); // This transport ignores the repeated denial's abort.
      await olderRead;
      assert.equal(h.page.last().data, null);
      assert.equal(h.scope.publish(view), false);

      const freshRead = h.page.controller.refresh();
      const restored = { ...view, name: "Fresh authorized view" };
      h.requests.at(-1)!.reply(restored);
      await freshRead;
      assert.equal(h.page.last().data, restored);
      assert.equal(h.page.last().error, null);
      const renamed = { ...restored, name: "Authorized rename" };
      assert.equal(h.scope.publish(renamed), true);
      assert.equal(h.desktop.last().data?.views[0], renamed);
      assert.equal(h.mobile.last().data?.views[0], renamed);
      assert.equal(h.page.last().data, renamed);
      assert.equal(await h.drain(renamed), 0);

      // A real admission followed by a new denial still asks both navigation
      // mounts to revalidate, and then settles in the denied state again.
      const recoveredCounts = h.counts();
      h.scope.deny(view.id, new ApiError(404, {}));
      assert.equal(h.counts().desktop, recoveredCounts.desktop + 1);
      assert.equal(h.counts().mobile, recoveredCounts.mobile + 1);
      assert.equal(await h.drain(), 0);
      assert.equal(h.scope.publish(view), false);
      assert.equal(h.page.last().data, null);
    } finally {
      await h.dispose();
    }
  })();
});
