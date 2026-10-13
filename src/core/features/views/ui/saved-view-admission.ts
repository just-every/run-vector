import type { SavedView } from "../schema.ts";

export type SavedViewReceiptKind = "updated" | "created";
type Change =
  | { kind: "receipt"; receipt: SavedView }
  | {
      kind: "denial";
      ids: Set<string> | null;
      error: Error | null;
      retryNavigation: boolean;
      source?: object;
    };

// One mounted operator app owns this ledger. It survives route/phone-navigation
// remounts, but neither a new operator nor a new private document inherits it.
export function createSavedViewReceiptScope() {
  let active = true;
  let navigation: Set<string> | null = null;
  let unavailable: Error | null = null;
  const admitted = new Set<string>();
  const denied = new Map<string, Error | null>();
  const records = new Map<string, SavedView>();
  const known = new Set<string>();
  const listeners = new Set<(change: Change) => void>();
  const allowed = (id: string) =>
    active &&
    !denied.has(id) &&
    (admitted.has(id) ||
      (!unavailable && (navigation === null || navigation.has(id))));
  const notify = (change: Change) => {
    for (const listener of listeners) listener(change);
  };
  return {
    allowed,
    track(id: string) {
      known.add(id);
    },
    error(id?: string) {
      return (id && denied.get(id)) || unavailable;
    },
    records: () => [...records.values()].filter((view) => allowed(view.id)),
    subscribe(listener: (change: Change) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(receipt: SavedView, kind: SavedViewReceiptKind = "updated") {
      if (!active || denied.has(receipt.id)) return false;
      if (kind === "created") {
        // POST creates a new identity. It cannot override a denial already
        // observed for that identity or for the current session.
        if (unavailable) return false;
        admitted.add(receipt.id);
      } else if (!allowed(receipt.id)) return false;
      known.add(receipt.id);
      records.set(receipt.id, receipt);
      notify({ kind: "receipt", receipt });
      return true;
    },
    deny(id: string | undefined, error: Error | null, source?: object) {
      if (!active) return;
      if (id) {
        // Revalidate on lost admission or an explicit deletion after an
        // unavailable read. Fresh error objects only update the denial;
        // every notification still retires reads older than that evidence.
        const changed =
          allowed(id) || (denied.get(id) != null && error === null);
        known.add(id);
        denied.set(id, error);
        admitted.delete(id);
        records.delete(id);
        notify({
          kind: "denial",
          ids: new Set([id]),
          error,
          source,
          retryNavigation: changed,
        });
      } else {
        const changed = !unavailable || admitted.size > 0 || records.size > 0;
        unavailable = error;
        admitted.clear();
        records.clear();
        for (const viewId of known) denied.set(viewId, error);
        notify({
          kind: "denial",
          ids: null,
          error,
          source,
          retryNavigation: changed,
        });
      }
    },
    read(views: SavedView[], complete: boolean, source?: object) {
      if (!active) return;
      const ids = new Set(views.map((view) => view.id));
      const omitted = new Set<string>();
      let removed = false;
      if (complete) {
        for (const id of known) {
          if (!ids.has(id)) {
            omitted.add(id);
            if (allowed(id)) removed = true;
            // Omission is authoritative even after every reader unmounts.
            if (!denied.has(id)) denied.set(id, null);
          }
        }
        navigation = ids;
        unavailable = null;
        admitted.clear();
        records.clear();
      }
      for (const view of views) {
        known.add(view.id);
        denied.delete(view.id);
        admitted.add(view.id);
        records.set(view.id, view);
      }
      // Every confirmation retires recovery reads older than this result.
      // Only a new removal asks other navigation mounts to read again, so
      // matching authoritative omissions cannot trigger a retry loop.
      if (omitted.size)
        notify({
          kind: "denial",
          ids: omitted,
          error: null,
          source,
          retryNavigation: removed,
        });
    },
    activate() {
      active = true;
    },
    retire() {
      active = false;
      navigation = null;
      unavailable = null;
      admitted.clear();
      denied.clear();
      records.clear();
      known.clear();
      listeners.clear();
    },
  };
}
export type SavedViewReceiptScope = ReturnType<
  typeof createSavedViewReceiptScope
>;

// A pending action belongs to one mounted author as well as one operator app.
// A route change can retire the author without erasing the app's denial ledger.
export function createSavedViewReceiptPublisher(scope: SavedViewReceiptScope) {
  let active = true;
  return {
    publish(receipt: SavedView, kind?: SavedViewReceiptKind) {
      return active && scope.publish(receipt, kind);
    },
    activate() {
      active = true;
    },
    retire() {
      active = false;
    },
  };
}
