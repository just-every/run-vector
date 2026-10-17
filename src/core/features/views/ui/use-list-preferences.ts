import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "../../../app/api-client";
import { useInitialResource } from '../../../app/initial-resources';
import {
  preferenceSchema,
  type ListPreference,
  type PreferenceSurface,
} from "../schema";
import { createPreferenceWriteQueue } from "./preference-write-queue";

export type ListPreferenceSurface = PreferenceSurface;

/** Server-stored controls for one browsing surface. */
export interface ListPreferenceValues<
  Filters extends Record<string, unknown>,
  Sort extends string,
  Grouping extends string,
> {
  filters: Filters;
  sort: Sort;
  grouping: Grouping;
}

/** Values, persistence status, retries, and reset action returned by the hook. */
export interface UseListPreferencesResult<
  Filters extends Record<string, unknown>,
  Sort extends string,
  Grouping extends string,
> extends ListPreferenceValues<Filters, Sort, Grouping> {
  /** True after the server has restored this operator's values. */
  ready: boolean;
  loading: boolean;
  saving: boolean;
  loadError: Error | null;
  saveError: Error | null;
  update: (
    changes: Partial<ListPreferenceValues<Filters, Sort, Grouping>>,
  ) => void;
  reset: () => void;
  retryLoad: () => void;
  retrySave: () => void;
}

type PreferenceReceipt = ListPreference;
type PreferenceOperation = "put" | "delete";
type LoadPhase = "loading" | "ready" | "error";

type PreferenceSnapshot<
  Filters extends Record<string, unknown>,
  Sort extends string,
  Grouping extends string,
> = {
  surface: ListPreferenceSurface;
  values: ListPreferenceValues<Filters, Sort, Grouping>;
  phase: LoadPhase;
  loadError: Error | null;
  saving: boolean;
  saveError: Error | null;
  pendingOperation: PreferenceOperation | null;
  intent: number;
  // A control changed before the stored values arrived; it wins and is saved.
  earlyChange: boolean;
};

/**
 * Restores one operator's server-stored controls before accepting edits, then
 * persists each applied change. Defaults must match the surface API.
 */
export function useListPreferences<
  Filters extends Record<string, unknown>,
  Sort extends string,
  Grouping extends string,
>(
  surface: ListPreferenceSurface,
  defaults: ListPreferenceValues<Filters, Sort, Grouping>,
): UseListPreferencesResult<Filters, Sort, Grouping> {
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const sequence = useRef(0);
  const loadSequence = useRef(0);
  const queue = useRef<ReturnType<typeof createPreferenceWriteQueue> | null>(
    null,
  );
  if (queue.current === null) queue.current = createPreferenceWriteQueue();

  const initial = useInitialResource(`/api/preferences/${surface}`, preferenceSchema);
  // A mounted list consumes its initial receipt once. Route navigation replaces
  // the provider receipt; it must not unload already-restored list controls.
  const initialAtMount = useRef(initial);
  const [snapshot, setSnapshot] = useState(() => {
    const snapshot = initialSnapshot(surface, defaultsRef.current);
    return initial === null ? snapshot : { ...snapshot, phase: 'ready' as const,
      values: valuesFromReceipt<Filters, Sort, Grouping>(surface, defaultsRef.current, initial) };
  });
  const snapshotRef = useRef(snapshot);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const publish = useCallback(
    (next: PreferenceSnapshot<Filters, Sort, Grouping>) => {
      snapshotRef.current = next;
      setSnapshot(next);
    },
    [],
  );

  useEffect(() => {
    if (initialAtMount.current !== null && snapshotRef.current.surface === surface && loadAttempt === 0) return;
    const request = ++loadSequence.current;
    const controller = new AbortController();
    const current = snapshotRef.current;
    publish(
      current.surface === surface
        ? { ...current, phase: "loading", loadError: null }
        : initialSnapshot(surface, defaultsRef.current),
    );

    // Let an immediately discarded mount (React development) dispose before
    // any network work starts, as the shared API resource does.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void fetchJson(`/api/preferences/${surface}`, preferenceSchema, {
        signal: controller.signal,
      })
        .then((receipt) => {
          if (controller.signal.aborted || request !== loadSequence.current)
            return;
          const values = valuesFromReceipt<Filters, Sort, Grouping>(
            surface,
            defaultsRef.current,
            receipt,
          );
          const latest = snapshotRef.current;
          if (latest.surface === surface && latest.earlyChange) {
            const intent = ++sequence.current;
            publish({
              ...latest,
              phase: "ready",
              earlyChange: false,
              intent,
              saving: true,
              pendingOperation: "put",
            });
            enqueueWrite(surface, intent, "put", latest.values);
            return;
          }
          publish({
            ...initialSnapshot(surface, defaultsRef.current),
            values,
            phase: "ready",
            intent: ++sequence.current,
          });
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted || request !== loadSequence.current)
            return;
          const error = asError(cause);
          const latest = snapshotRef.current;
          if (latest.surface !== surface) return;
          publish({ ...latest, phase: "error", loadError: error });
        });
    });

    return () => controller.abort();
  }, [loadAttempt, publish, surface]);

  const visible =
    snapshot.surface === surface
      ? snapshot
      : initialSnapshot(surface, defaultsRef.current);

  const enqueueWrite = useCallback(
    (
      targetSurface: ListPreferenceSurface,
      intent: number,
      operation: PreferenceOperation,
      values: ListPreferenceValues<Filters, Sort, Grouping>,
    ) => {
      void queue.current!(async () => {
        const body = {
          filters: values.filters,
          sort: values.sort,
          grouping: values.grouping,
        };
        const receipt = await fetchJson(
          `/api/preferences/${targetSurface}`,
          preferenceSchema,
          operation === "delete"
            ? { method: "DELETE" }
            : {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              },
        );

        const latest = snapshotRef.current;
        if (latest.surface !== targetSurface || latest.intent !== intent)
          return;

        const nextValues = valuesFromReceipt<Filters, Sort, Grouping>(
          targetSurface,
          defaultsRef.current,
          receipt,
        );
        publish({
          ...latest,
          values: nextValues,
          saving: false,
          saveError: null,
          pendingOperation: null,
        });
      }).catch((cause: unknown) => {
        const latest = snapshotRef.current;
        if (latest.surface !== targetSurface || latest.intent !== intent)
          return;
        publish({ ...latest, saving: false, saveError: asError(cause) });
      });
    },
    [publish],
  );

  const update = useCallback(
    (changes: Partial<ListPreferenceValues<Filters, Sort, Grouping>>) => {
      const current = snapshotRef.current;
      if (current.surface !== surface || current.phase === "error") return;
      const values = { ...current.values, ...changes };
      if (sameValues(current.values, values)) return;
      if (current.phase === "loading") {
        publish({ ...current, values, earlyChange: true });
        return;
      }
      const intent = ++sequence.current;
      publish({
        ...current,
        values,
        intent,
        saving: true,
        saveError: null,
        pendingOperation: "put",
      });
      enqueueWrite(surface, intent, "put", values);
    },
    [enqueueWrite, publish, surface],
  );

  const reset = useCallback(() => {
    const current = snapshotRef.current;
    if (
      current.surface !== surface ||
      (current.phase !== "ready" && current.phase !== "error")
    )
      return;
    const values = defaultsRef.current;
    const intent = ++sequence.current;
    publish({
      ...current,
      values,
      phase: "ready",
      loadError: null,
      intent,
      saving: true,
      saveError: null,
      pendingOperation: "delete",
    });
    enqueueWrite(surface, intent, "delete", values);
  }, [enqueueWrite, publish, surface]);

  const retryLoad = useCallback(() => {
    const current = snapshotRef.current;
    if (current.surface === surface && current.phase === "error")
      setLoadAttempt((attempt) => attempt + 1);
  }, [surface]);

  const retrySave = useCallback(() => {
    const current = snapshotRef.current;
    if (
      current.surface !== surface ||
      current.phase !== "ready" ||
      current.pendingOperation === null
    )
      return;
    const intent = ++sequence.current;
    publish({ ...current, intent, saving: true, saveError: null });
    enqueueWrite(surface, intent, current.pendingOperation, current.values);
  }, [enqueueWrite, publish, surface]);

  return {
    ...visible.values,
    ready: visible.phase === "ready",
    loading: visible.phase === "loading",
    saving: visible.saving,
    loadError: visible.loadError,
    saveError: visible.saveError,
    update,
    reset,
    retryLoad,
    retrySave,
  };
}

function initialSnapshot<
  Filters extends Record<string, unknown>,
  Sort extends string,
  Grouping extends string,
>(
  surface: ListPreferenceSurface,
  values: ListPreferenceValues<Filters, Sort, Grouping>,
): PreferenceSnapshot<Filters, Sort, Grouping> {
  return {
    surface,
    values,
    phase: "loading",
    loadError: null,
    saving: false,
    saveError: null,
    pendingOperation: null,
    intent: 0,
    earlyChange: false,
  };
}

function valuesFromReceipt<
  Filters extends Record<string, unknown>,
  Sort extends string,
  Grouping extends string,
>(
  surface: ListPreferenceSurface,
  defaults: ListPreferenceValues<Filters, Sort, Grouping>,
  receipt: PreferenceReceipt,
): ListPreferenceValues<Filters, Sort, Grouping> {
  if (receipt.surface !== surface)
    throw new Error(
      `Preferences returned for ${receipt.surface}, expected ${surface}.`,
    );
  for (const [key, defaultValue] of Object.entries(defaults.filters)) {
    if (!(key in receipt.filters))
      throw new Error(`Saved controls are missing the ${key} filter.`);
    if (jsonKind(receipt.filters[key]) !== jsonKind(defaultValue))
      throw new Error(`Saved controls contain an invalid ${key} filter.`);
  }
  return {
    filters: receipt.filters as Filters,
    sort: receipt.sort as Sort,
    grouping: receipt.grouping as Grouping,
  };
}

function jsonKind(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function sameValues<
  Filters extends Record<string, unknown>,
  Sort extends string,
  Grouping extends string,
>(
  left: ListPreferenceValues<Filters, Sort, Grouping>,
  right: ListPreferenceValues<Filters, Sort, Grouping>,
) {
  return (
    JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
  );
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  return value;
}

function asError(cause: unknown) {
  return cause instanceof Error ? cause : new Error("The request failed.");
}
