import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import { useInitialResource } from '../../../app/initial-resources';
import {
  fetchJson,
  resourceStateForIdentity,
} from "../../../app/api-client.ts";
import { savedViewSchema, type SavedView } from "../schema.ts";
import {
  createSavedViewReceiptController,
  mergeSavedViewReceipt,
  mergeNavigationReceipt,
  navigationAdmission,
} from "./saved-view-receipt.ts";

import {
  createSavedViewReceiptScope,
  createSavedViewReceiptPublisher,
  type SavedViewReceiptScope,
} from "./saved-view-admission.ts";

export const savedViewsSchema = z.object({ views: z.array(savedViewSchema) });
const ReceiptScope = createContext<SavedViewReceiptScope | null>(null);

export function SavedViewReceiptProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [scope] = useState(createSavedViewReceiptScope);
  useEffect(() => {
    scope.activate();
    return () => scope.retire();
  }, [scope]);
  return createElement(ReceiptScope.Provider, { value: scope }, children);
}

export function useSavedViewReceiptScope() {
  const scope = useContext(ReceiptScope);
  if (!scope) throw new Error("Saved views require the operator app scope.");
  return scope;
}

export function useSavedViewReceiptPublisher() {
  const scope = useSavedViewReceiptScope();
  const publisher = useMemo(
    () => createSavedViewReceiptPublisher(scope),
    [scope],
  );
  useEffect(() => {
    publisher.activate();
    return () => publisher.retire();
  }, [publisher]);
  return publisher.publish;
}

export function useSavedViewResource(viewId: string) {
  const merge = useCallback(
    (_data: SavedView | null, receipt: SavedView) =>
      mergeSavedViewReceipt(viewId, receipt),
    [viewId],
  );
  return useReceiptResource(`/api/views/${viewId}`, savedViewSchema, merge, {
    viewId,
  });
}

export function useSavedViewNavigation() {
  return useReceiptResource(
    "/api/views",
    savedViewsSchema,
    mergeNavigationReceipt,
    { pollMs: 10000, admission: navigationAdmission },
  );
}

function useReceiptResource<S extends z.ZodType>(
  url: string,
  schema: S,
  merge: (data: z.output<S> | null, receipt: SavedView) => z.output<S> | null,
  {
    pollMs,
    viewId,
    admission,
  }: {
    pollMs?: number;
    viewId?: string;
    admission?: {
      remove: (data: z.output<S> | null, viewId: string) => z.output<S> | null;
      views: (data: z.output<S>) => SavedView[];
    };
  },
) {
  const scope = useSavedViewReceiptScope();
  const initial = useInitialResource(url, schema);
  const [snapshot, setSnapshot] = useState({
    url,
    schema,
    scope,
    data: initial,
    error: null as Error | null,
    loading: initial === null,
  });
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const controller = useRef<ReturnType<
    typeof createSavedViewReceiptController<z.output<S>>
  > | null>(null);
  const reload = useCallback(() => {
    void controller.current?.refresh();
  }, []);
  useEffect(() => {
    if (initial !== null && admission) scope.read(admission.views(initial), true);
    const reader = createSavedViewReceiptController(
      (signal) => fetchJson(url, schema, { signal }),
      (state) => {
        const next = { ...state, url, schema, scope };
        latest.current = next;
        setSnapshot(next);
      },
      merge,
      initial !== null ? { data: initial, error: null, loading: false } : latest.current.scope === scope
        ? resourceStateForIdentity(latest.current, url, schema)
        : { data: null, error: null, loading: true },
      admission,
      { scope, viewId },
    );
    controller.current = reader;
    const refresh = () => {
      if (document.visibilityState === "visible")
        void reader.refresh({ skipIfPending: true });
    };
    if (initial === null) queueMicrotask(() => void reader.refresh());
    const interval = pollMs ? window.setInterval(refresh, pollMs) : undefined;
    if (pollMs) document.addEventListener("visibilitychange", refresh);
    return () => {
      reader.dispose();
      if (controller.current === reader) controller.current = null;
      if (interval !== undefined) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [url, schema, merge, pollMs, viewId, admission, scope, initial]);
  return {
    ...(snapshot.scope === scope
      ? resourceStateForIdentity(snapshot, url, schema)
      : { data: null, error: null, loading: true }),
    reload,
  };
}
