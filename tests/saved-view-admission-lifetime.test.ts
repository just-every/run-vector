import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, type ResourceState } from "../src/core/app/api-client.ts";
import { issueListQuerySchema } from "../src/core/features/issues/list-schema.ts";
import type { SavedView } from "../src/core/features/views/schema.ts";
import {
  createSavedViewReceiptScope,
  createSavedViewReceiptPublisher,
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
  name: "Private saved view",
  isShared: false,
  layout: "board",
  query: issueListQuerySchema.parse({
    text: "Private query",
    priority: "high",
  }),
};
const other = { ...view, id: "01ARZ3NDEKTSV4RRFFQ69G5FAX", name: "Other view" };
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
const navigation = (scope: SavedViewReceiptScope) =>
  resource<Navigation>(scope, mergeNavigationReceipt, navigationAdmission);
const detail = (scope: SavedViewReceiptScope, id = view.id) =>
  resource<SavedView>(
    scope,
    (_data, receipt) => mergeSavedViewReceipt(id, receipt),
    undefined,
    id,
  );
async function delivered() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("Saved-view admission survives reader and identity lifetimes without leaking private receipts", async (context) => {
  // Scenario: "403/404 denial survives phone navigation and detail remount, including a PATCH from an unmounted action"
  await (async () => {
    for (const status of [403, 404, 410]) {
      const scope = createSavedViewReceiptScope();
      const desktop = navigation(scope),
        mobile = navigation(scope),
        page = detail(scope);
      scope.publish(view, "created");
      desktop.calls[0].resolve({ views: [view, other] });
      mobile.calls[0].resolve({ views: [view, other] });
      page.calls[0].resolve(view);
      await delivered();
      const pending = page.controller.refresh();
      page.calls[1].reject(new ApiError(status, {}));
      await pending;
      assert.deepEqual(desktop.last().data?.views, [other]);
      assert.deepEqual(mobile.last().data?.views, [other]);
      mobile.controller.dispose();
      page.controller.dispose();
      // Current/Search/issue-detail unmount the phone list; the action's async
      // continuation still owns this app scope when Board/Issues/views remount.
      const newMobile = navigation(scope),
        newPage = detail(scope);
      const nextListRead = newMobile.controller.refresh();
      const nextDetailRead = newPage.controller.refresh();
      assert.equal(scope.publish({ ...view, name: "Held older PATCH" }), false);
      assert.equal(
        newMobile.last().data?.views.some((record) => record.id === view.id),
        false,
      );
      assert.equal(newPage.last().data, null);
      newMobile.calls[0].reject(new TypeError("Offline after remount"));
      newPage.calls[0].reject(new TypeError("Offline after remount"));
      await Promise.all([nextListRead, nextDetailRead]);
      assert.equal(scope.publish(view), false);
      assert.equal(newPage.last().data, null);
      const fresh = newPage.controller.refresh();
      const restored = { ...view, name: "New authorized read" };
      newPage.calls[1].resolve(restored);
      await fresh;
      const renamed = { ...restored, name: "Current rename" };
      assert.equal(scope.publish(renamed), true);
      assert.equal(newPage.last().data, renamed);
      assert.equal(
        newMobile.last().data?.views.find((record) => record.id === view.id),
        renamed,
      );
      desktop.controller.dispose();
      newMobile.controller.dispose();
      newPage.controller.dispose();
      scope.retire();
    }
  })();
  // Scenario: "list omission persists when every reader unmounts and only a new including read restores admission"
  await (async () => {
    const scope = createSavedViewReceiptScope();
    const old = navigation(scope);
    const loaded = old.controller.refresh();
    old.calls[0].resolve({ views: [view, other] });
    await loaded;
    const omitted = old.controller.refresh();
    old.calls[1].resolve({ views: [other] });
    await omitted;
    old.controller.dispose();
    const next = navigation(scope),
      page = detail(scope);
    try {
      assert.equal(scope.publish(view), false);
      assert.equal(page.last().data, null);
      assert.deepEqual(next.last().data?.views, [other]);
      const absent = next.controller.refresh();
      next.calls[0].resolve({ views: [other] });
      await absent;
      assert.equal(scope.publish(view), false);
      const included = next.controller.refresh();
      next.calls[1].resolve({ views: [view, other] });
      await included;
      const rename = { ...view, name: "Authorized later rename" };
      assert.equal(scope.publish(rename), true);
      assert.equal(page.last().data, rename);
      assert.equal(
        next.last().data?.views.find((record) => record.id === view.id),
        rename,
      );
    } finally {
      next.controller.dispose();
      page.controller.dispose();
      scope.retire();
    }
  })();
  // Scenario: "a denied detail retires older GETs across readers so their successful transport cannot re-admit it"
  await (async () => {
    const scope = createSavedViewReceiptScope();
    const nav = navigation(scope),
      first = detail(scope),
      second = detail(scope);
    const oldNav = nav.controller.refresh(),
      oldDetail = second.controller.refresh();
    const denial = first.controller.refresh();
    first.calls[0].reject(new ApiError(403, {}));
    await denial;
    assert.equal(nav.calls[0].signal.aborted, true);
    assert.equal(second.calls[0].signal.aborted, true);
    nav.calls[0].resolve({ views: [view] });
    second.calls[0].resolve(view);
    await Promise.all([oldNav, oldDetail]);
    assert.equal(scope.publish(view), false);
    assert.equal(second.last().data, null);
    assert.equal(nav.last().data, null);
    first.controller.dispose();
    second.controller.dispose();
    nav.controller.dispose();
    scope.retire();
  })();
  // Scenario: "create and duplicate receipts admit new identities before immediate rename without waiting for a list poll"
  await (async () => {
    for (const created of [
      view,
      { ...view, id: other.id, name: "Duplicate" },
    ]) {
      const scope = createSavedViewReceiptScope();
      const desktop = navigation(scope),
        mobile = navigation(scope);
      const read = desktop.controller.refresh();
      desktop.calls[0].resolve({ views: [] });
      await read;
      const phoneRead = mobile.controller.refresh();
      mobile.calls[0].resolve({ views: [] });
      await phoneRead;
      assert.equal(scope.publish(created, "created"), true);
      // POST publishes before route navigation; the new detail mounts with its
      // authorized receipt even while its first GET has not completed.
      const page = detail(scope, created.id);
      try {
        assert.equal(page.last().data, created);
        assert.equal(desktop.last().data?.views[0], created);
        assert.equal(mobile.last().data?.views[0], created);
        const rename = { ...created, name: "Created then immediately renamed" };
        assert.equal(scope.publish(rename), true);
        assert.equal(page.last().data, rename);
        assert.equal(desktop.last().data?.views[0], rename);
        assert.equal(mobile.last().data?.views[0], rename);
        assert.equal(desktop.calls[1].signal.aborted, true);
        desktop.calls[1].resolve({ views: [created] });
        mobile.calls[1].resolve({ views: [created] });
        await delivered();
        assert.equal(page.last().data, rename);
        assert.equal(desktop.last().data?.views[0], rename);
        // A creation-shaped stale response cannot undo a real denial either.
        scope.deny(created.id, new ApiError(404, {}));
        assert.equal(scope.publish(created, "created"), false);
        assert.equal(page.last().data, null);
      } finally {
        desktop.controller.dispose();
        mobile.controller.dispose();
        page.controller.dispose();
        scope.retire();
      }
    }
  })();
  // Scenario: "operator or private-document replacement retires old publishers and caches without carrying denial forward"
  await (async () => {
    for (const identity of [
      "different operator",
      "new session for same operator",
    ]) {
      const oldScope = createSavedViewReceiptScope();
      const oldPage = detail(oldScope);
      const publishOldAction = oldScope.publish;
      publishOldAction(view, "created");
      oldScope.deny(view.id, new ApiError(403, {}));
      oldPage.controller.dispose();
      oldScope.retire();
      const newScope = createSavedViewReceiptScope();
      const newPage = detail(newScope),
        newNavigation = navigation(newScope);
      try {
        assert.equal(publishOldAction(view), false, identity);
        assert.equal(publishOldAction(other, "created"), false, identity);
        assert.equal(newPage.last().data, null, identity);
        assert.equal(newNavigation.last().data, null, identity);
        assert.deepEqual(oldScope.records(), [], identity);
        const authorized = newPage.controller.refresh();
        newPage.calls[0].resolve(view);
        await authorized;
        assert.equal(newPage.last().data, view, identity);
        assert.equal(
          newScope.publish({ ...view, name: identity }),
          true,
          identity,
        );
      } finally {
        newPage.controller.dispose();
        newNavigation.controller.dispose();
        newScope.retire();
      }
    }
  })();
  // Scenario: "session denial clears all private receipts and survives remount until fresh reads actually include each record"
  await (async () => {
    const scope = createSavedViewReceiptScope();
    scope.publish(view, "created");
    scope.publish(other, "created");
    const page = detail(scope);
    const expired = page.controller.refresh();
    page.calls[0].reject(new ApiError(401, {}));
    await expired;
    page.controller.dispose();
    const next = navigation(scope),
      nextPage = detail(scope);
    try {
      assert.equal(next.last().data, null);
      assert.equal(nextPage.last().data, null);
      assert.equal(scope.publish(view), false);
      assert.equal(scope.publish(other), false);
      const restored = nextPage.controller.refresh();
      nextPage.calls[0].resolve(view);
      await restored;
      assert.equal(
        scope.publish({ ...view, name: "Fresh session receipt" }),
        true,
      );
      assert.equal(
        scope.publish(other),
        false,
        "one fresh detail read cannot recover a different private record",
      );
    } finally {
      next.controller.dispose();
      nextPage.controller.dispose();
      scope.retire();
    }
  })();
  // Scenario: "two navigation readers preserve session denial without triggering each other into retry loops"
  await (async () => {
    const scope = createSavedViewReceiptScope();
    const desktop = navigation(scope),
      mobile = navigation(scope);
    const initial = desktop.controller.refresh();
    desktop.calls[0].reject(new ApiError(403, {}));
    await initial;
    assert.equal(mobile.calls.length, 1);
    mobile.calls[0].reject(new ApiError(403, {}));
    await delivered();
    assert.equal(desktop.calls.length, 1);
    assert.equal(mobile.calls.length, 1);
    assert.equal(scope.publish(view), false);
    desktop.controller.dispose();
    mobile.controller.dispose();
    scope.retire();
  })();
  // Scenario: "successful deletion evicts the cached record and denies a held earlier edit across route remounts"
  await (async () => {
    const scope = createSavedViewReceiptScope();
    scope.publish(view, "created");
    const page = detail(scope),
      nav = navigation(scope);
    // SavedViewActions applies the successful DELETE to the same authority.
    scope.deny(view.id, null);
    assert.equal(page.last().data, null);
    assert.deepEqual(nav.last().data?.views, []);
    page.controller.dispose();
    const revisited = detail(scope);
    try {
      assert.equal(revisited.last().data, null);
      assert.equal(scope.publish(view), false);
      const read = revisited.controller.refresh();
      revisited.calls[0].reject(new ApiError(404, {}));
      await read;
      assert.equal(revisited.last().data, null);
      assert.equal((revisited.last().error as ApiError).status, 404);
    } finally {
      revisited.controller.dispose();
      nav.controller.dispose();
      scope.retire();
    }
  })();
  // Scenario: "unmounting an action retires its publisher independently of the still-mounted app"
  await (() => {
    const scope = createSavedViewReceiptScope();
    const previousAction = createSavedViewReceiptPublisher(scope);
    scope.publish(view, "created");
    const nav = navigation(scope);
    previousAction.retire();
    const remountedAction = createSavedViewReceiptPublisher(scope);
    try {
      assert.equal(
        previousAction.publish({ ...view, name: "Old component response" }),
        false,
      );
      assert.equal(nav.last().data?.views[0], view);
      const updated = { ...view, name: "Current component response" };
      assert.equal(remountedAction.publish(updated), true);
      assert.equal(nav.last().data?.views[0], updated);
      scope.retire();
      assert.equal(
        remountedAction.publish(view),
        false,
        "operator scope retirement also retires a current actor",
      );
    } finally {
      nav.controller.dispose();
      previousAction.retire();
      remountedAction.retire();
      scope.retire();
    }
  })();
});
