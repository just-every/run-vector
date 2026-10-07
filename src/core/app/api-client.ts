import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

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
  const response = await fetch(url, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, body);
  return schema.parse(body);
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
  const write = (next: ResourceState<T>) => {
    current = next;
    publish(next);
  };
  return {
    async refresh({ skipIfPending = false }: { skipIfPending?: boolean } = {}) {
      if (!active || (skipIfPending && pending !== null)) return;
      const request = ++sequence;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
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
        if (request === sequence) pending = null;
      }
    },
    dispose() {
      active = false;
      ++sequence;
      pending?.abort();
      pending = null;
    },
  };
}

export function useApiResource<S extends z.ZodType>(
  url: string,
  schema: S,
  pollMs?: number,
) {
  const [snapshot, setSnapshot] = useState<ResourceSnapshot<z.output<S>>>({
    url,
    schema,
    data: null,
    error: null,
    loading: true,
  });
  const latestSnapshot = useRef(snapshot);
  latestSnapshot.current = snapshot;
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((current) => current + 1), []);

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
    // Let an immediately discarded mount dispose before starting network work.
    // The controller still aborts real in-flight reads on navigation/refresh.
    queueMicrotask(() => void controller.refresh());
    if (!pollMs) return () => controller.dispose();
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
      controller.dispose();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [url, schema, revision, pollMs]);

  return { ...resourceStateForIdentity(snapshot, url, schema), reload };
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
