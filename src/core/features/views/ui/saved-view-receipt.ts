import {
  ApiError,
  createApiResourceController,
  isUnavailableResourceError,
  type ResourceState,
} from "../../../app/api-client.ts";
import type { SavedView } from "../schema.ts";
import {
  createSavedViewReceiptScope,
  type SavedViewReceiptKind,
  type SavedViewReceiptScope,
} from "./saved-view-admission.ts";

type NavigationAdmission<T> = {
  remove: (data: T | null, viewId: string) => T | null;
  views: (data: T) => SavedView[];
};

// Readers retain transport cancellation locally. Admission and mutation
// receipts belong to the operator app, so remounting cannot erase a denial.
export function createSavedViewReceiptController<T>(
  load: (signal: AbortSignal) => Promise<T>,
  publish: (state: ResourceState<T>) => void,
  merge: (data: T | null, receipt: SavedView) => T | null,
  initial: ResourceState<T>,
  admission?: NavigationAdmission<T>,
  context?: { scope: SavedViewReceiptScope; viewId?: string },
) {
  const scope = context?.scope ?? createSavedViewReceiptScope();
  const viewId = context?.viewId;
  const source = {};
  if (viewId) scope.track(viewId);
  if (!context && admission && initial.data)
    scope.read(admission.views(initial.data), true, source);
  let current = initial,
    active = true,
    denied = isUnavailableResourceError(initial.error);
  if (context) {
    if (viewId && !scope.allowed(viewId))
      current = { data: null, error: scope.error(viewId), loading: true };
    else if (admission && current.data)
      for (const view of admission.views(current.data))
        if (!scope.allowed(view.id))
          current = {
            ...current,
            data: admission.remove(current.data, view.id),
          };
    for (const receipt of scope.records()) {
      const data = merge(current.data, receipt);
      if (data !== null) current = { data, error: null, loading: false };
    }
  }
  const write = (state: ResourceState<T>) => {
    const newDenial =
      state.error !== current.error && isUnavailableResourceError(state.error);
    if (isUnavailableResourceError(state.error)) denied = true;
    else if (state.data !== null && state.error === null) denied = false;
    current = state;
    publish(state);
    if (newDenial)
      scope.deny(
        state.error instanceof ApiError && state.error.status === 401
          ? undefined
          : viewId,
        state.error,
        source,
      );
  };
  const createReader = () =>
    createApiResourceController(
      async (signal) => {
        const data = await load(signal);
        if (active && !signal.aborted) {
          if (admission) scope.read(admission.views(data), true, source);
          else scope.read([data as SavedView], false, source);
        }
        return data;
      },
      write,
      current,
    );
  let reader = createReader();
  const unsubscribe = scope.subscribe((change) => {
    if (!active) return;
    if (change.kind === "receipt") {
      if ((denied && !context) || !scope.allowed(change.receipt.id)) return;
      const data = merge(current.data, change.receipt);
      if (data === null) return;
      reader.dispose();
      write({ data, error: null, loading: false });
    } else {
      if (change.source === source) return;
      if (!admission && (!viewId || (change.ids && !change.ids.has(viewId))))
        return;
      reader.dispose();
      if (admission && change.ids) {
        let data = current.data;
        for (const id of change.ids) data = admission.remove(data, id);
        current = { ...current, data };
      } else {
        current = { data: null, error: change.error, loading: !change.error };
        denied = !!change.error;
      }
      publish(current);
    }
    reader = createReader();
    // Reconfirmations still retire older transports, but two navigation
    // mounts must not retry each other forever after matching denials.
    // An omitted detail re-reads to show its current authorized/error state.
    if (
      change.kind === "receipt" ||
      (admission ? change.retryNavigation : !change.error)
    )
      void reader.refresh();
  });
  if (context) publish(current);
  return {
    refresh: (options?: { skipIfPending?: boolean }) => reader.refresh(options),
    accept(receipt: SavedView, kind: SavedViewReceiptKind = "updated") {
      if (!active || (denied && !context)) return;
      scope.publish(receipt, kind);
    },
    deny(id: string) {
      if (active) scope.deny(id, null);
    },
    dispose() {
      active = false;
      reader.dispose();
      unsubscribe();
      if (!context) scope.retire();
    },
  };
}

export function mergeSavedViewReceipt(viewId: string, receipt: SavedView) {
  return viewId === receipt.id ? receipt : null;
}

export function mergeNavigationReceipt(
  data: { views: SavedView[] } | null,
  receipt: SavedView,
) {
  // Admission is checked by the shared ledger before this merge. A newly
  // created or freshly read view can therefore join an already loaded list.
  return {
    views: [
      ...(data?.views ?? []).filter((view) => view.id !== receipt.id),
      receipt,
    ].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
  };
}

export const navigationAdmission = {
  remove(data: { views: SavedView[] } | null, viewId: string) {
    return data && { views: data.views.filter((view) => view.id !== viewId) };
  },
  views: (data: { views: SavedView[] }) => data.views,
};
