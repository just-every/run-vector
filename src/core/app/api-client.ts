import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { privateReads } from "./read-lifecycle.ts";
import { resourceKey, useInitialResource } from './initial-resources';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    super(messageForBody(body, status));
    this.status = status;
    this.body = body;
  }
}

export async function fetchJson<S extends z.ZodType>(
  url: string,
  schema: S,
  init?: RequestInit,
): Promise<z.output<S>> {
  const load = async () => {
    const response = await fetch(url, init);
    const body: unknown = await response.json().catch(() => null);
    if(response.status===401&&typeof window!=='undefined')window.dispatchEvent(new Event('vector:auth-lost'));
    if (!response.ok) throw new ApiError(response.status, body);
    return schema.parse(body);
  };
  return (init?.method ?? "GET").toUpperCase() === "GET" &&
    new URL(url, "http://vector.invalid").pathname.startsWith("/api/")
    ? privateReads.read(url, load)
    : load();
}

export type ResourceState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
};
type ResourceSnapshot<T> = ResourceState<T> & { url: string; schema: unknown };

export function isUnavailableResourceError(error: unknown): boolean {
  return (
    error instanceof ApiError && [401, 403, 404, 410].includes(error.status)
  );
}

// Identity is checked during render, before effects run, so changing an issue
// URL cannot display the previous issue while its replacement is loading.
export function resourceStateForIdentity<T>(
  snapshot: ResourceSnapshot<T>,
  url: string,
  schema: unknown,
): ResourceState<T> {
  return snapshot.url === url && snapshot.schema === schema
    ? { data: snapshot.data, error: snapshot.error, loading: snapshot.loading }
    : { data: null, error: null, loading: true };
}

// A controller belongs to one effect/identity. Cancellation saves work; the
// sequence guard also protects against transports that ignore AbortSignal.
export function createApiResourceController<T>(
  load: (signal: AbortSignal) => Promise<T>,
  publish: (state: ResourceState<T>) => void,
  initial: ResourceState<T> = { data: null, error: null, loading: true },
) {
  let current = initial,
    active = true,
    sequence = 0;
  let pending: AbortController | null = null;
  const reads = new Set<Promise<void>>();
  let mutationPending = false;
  let mutationRefresh: Promise<void> | null = null;
  let cancelResume: (() => void) | null = null;
  const write = (next: ResourceState<T>) => {
    current = next;
    publish(next);
  };
  const resource = {
    async refresh({
      skipIfPending = false,
    }: { skipIfPending?: boolean } = {}): Promise<void> {
      if (!active) return;
      if (privateReads.paused) {
        // A newly mounted non-polling resource also needs its skipped read
        // after a failed sign-out. Keep one retry and release it on disposal.
        cancelResume ??= privateReads.onResume(() => {
          cancelResume?.();
          cancelResume = null;
          void resource.refresh({ skipIfPending: true });
        });
        return;
      }
      if (skipIfPending && pending !== null) return;
      const request = ++sequence;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      let settled!: () => void;
      const finished = new Promise<void>((resolve) => { settled = resolve; });
      reads.add(finished);
      // Keep the last failure visible until a successful receipt. A retry may
      // still fail, and starting it must not briefly restore a healthy UI.
      write({ ...current, loading: current.data === null });
      try {
        const data = await load(controller.signal);
        if (active && request === sequence)
          write({ data, error: null, loading: false });
      } catch (cause) {
        if (active && request === sequence) {
          const error =
            cause instanceof Error ? cause : new Error("The request failed.");
          write({
            data: isUnavailableResourceError(error) ? null : current.data,
            error,
            loading: false,
          });
        }
      } finally {
        if (pending === controller) pending = null;
        reads.delete(finished);
        settled();
      }
    },
    refreshAfterMutation(): Promise<void> {
      if (!active) return Promise.resolve();
      // A committed update invalidates an older receipt, but does not cancel
      // its admitted read. Coalesce commits while that read drains, then read
      // again; a commit during the new read queues one more current snapshot.
      ++sequence;
      mutationPending = true;
      mutationRefresh ??= (async () => {
        try {
          while (active && mutationPending) {
            // An explicit reload may admit another read while this snapshot
            // drains. Recheck admission before taking over the next refresh.
            do { await Promise.all([...reads]); } while (active && reads.size);
            if (!active) break;
            mutationPending = false;
            await resource.refresh();
          }
        } finally {
          // Release ownership in the same turn as the final pending check.
          // A later commit must start a new drain, never join a settled one.
          mutationRefresh = null;
        }
      })();
      return mutationRefresh;
    },
    publishReceipt(update: (data: T | null) => T) {
      if (!active || privateReads.paused || isUnavailableResourceError(current.error)) return;
      // A committed mutation receipt supersedes every earlier list read.
      ++sequence;
      write({ data: update(current.data), error: null, loading: false });
    },
    dispose({ abortPending = true }: { abortPending?: boolean } = {}) {
      active = false;
      mutationPending = false;
      ++sequence;
      cancelResume?.();
      cancelResume = null;
      // Superseding evidence may drain an admitted transport. Retain it so a
      // later real unmount can still cancel it before settlement.
      if (abortPending) {
        pending?.abort();
        pending = null;
      }
      return Promise.all([...reads]).then(() => {});
    },
  };
  return resource;
}

export function useApiResource<S extends z.ZodType>(
  url: string,
  schema: S,
  pollMs?: number,
  { abortPendingOnDispose = true }: { abortPendingOnDispose?: boolean } = {},
) {
  url = resourceKey(url);
  const initial = useInitialResource(url, schema);
  const latestInitial = useRef(initial);
  latestInitial.current = initial;
  const [snapshot, setSnapshot] = useState<ResourceSnapshot<z.output<S>>>({
    url,
    schema,
    data: initial,
    error: null,
    loading: initial === null,
  });
  const latestSnapshot = useRef(snapshot);
  latestSnapshot.current = snapshot;
  const currentController = useRef<ReturnType<typeof createApiResourceController<z.output<S>>> | null>(null);
  const publishReceipt = useCallback((update: (data: z.output<S> | null) => z.output<S>) => { currentController.current?.publishReceipt(update); }, []);
  const reload = useCallback(() => { void currentController.current?.refresh(); }, []);
  const refreshAfterMutation = useCallback(() => { void currentController.current?.refreshAfterMutation(); }, []);

  useEffect(() => {
    const controller = createApiResourceController(
      (signal) => fetchJson(url, schema, { signal }),
      (state) => {
        const next = { ...state, url, schema };
        latestSnapshot.current = next;
        setSnapshot(next);
      },
      resourceStateForIdentity(latestSnapshot.current, url, schema),
    );
    currentController.current = controller;
    const dispose = () => {
      if (currentController.current === controller) currentController.current = null;
      controller.dispose({ abortPending: abortPendingOnDispose });
    };
    // Let an immediately discarded mount dispose before starting network work.
    // Draining disposal retires the controller without canceling its admitted
    // transport; fetchJson keeps that read in the private-read lifecycle.
    if (latestInitial.current === null)
      queueMicrotask(() => { if (latestInitial.current === null) void controller.refresh(); });
    if (!pollMs) return dispose;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void controller.refresh({ skipIfPending: true });
    }, pollMs);
    const visible = () => {
      if (document.visibilityState === "visible")
        void controller.refresh({ skipIfPending: true });
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      dispose();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [url, schema, pollMs, abortPendingOnDispose]);

  useEffect(() => {
    if (initial !== null) currentController.current?.publishReceipt(() => initial);
  }, [url, schema, pollMs, initial]);

  return { ...resourceStateForIdentity(snapshot, url, schema), reload, refreshAfterMutation, publishReceipt };
}

function messageForBody(body: unknown, status: number) {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  )
    return body.message;
  return `The request could not be completed (${status}).`;
}
