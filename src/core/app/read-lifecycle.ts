import { bindDocumentReadLifecycle } from "./document-read-lifecycle.ts";

// Each boundary owns its pause. Reopening document navigation cannot reopen a
// sign-out boundary, whose admitted reads still drain through their bodies.
export function createReadLifecycle() {
  const pauses = new Set<symbol>();
  const manualPause = Symbol("sign-out");
  const pending = new Map<symbol, string>();
  const idle = new Set<() => void>();
  const resumed = new Set<() => void>();
  const release = (owner: symbol) => {
    if (!pauses.delete(owner) || pauses.size) return;
    for (const notify of resumed) notify();
  };
  return {
    get paused() {
      return pauses.size > 0;
    },
    get manuallyPaused() {
      return pauses.has(manualPause);
    },
    async read<T>(url: string, load: () => Promise<T>): Promise<T> {
      if (pauses.size)
        throw new Error(
          pauses.has(manualPause)
            ? "Sign out is in progress. Try again afterwards."
            : "Another page is opening. Reload this page if navigation was cancelled.",
        );
      const key = Symbol();
      // Keep neither credentials, origins nor query/fragment values in diagnostics.
      pending.set(key, new URL(url, "http://vector.invalid").pathname);
      try {
        return await load();
      } finally {
        pending.delete(key);
        if (!pending.size) for (const notify of idle) notify();
      }
    },
    pause() {
      pauses.add(manualPause);
    },
    resume() {
      release(manualPause);
    },
    hold() {
      const owner = Symbol("document-navigation");
      pauses.add(owner);
      return () => release(owner);
    },
    onResume(notify: () => void) {
      resumed.add(notify);
      return () => {
        resumed.delete(notify);
      };
    },
    async settle(limit = 10000) {
      if (!pending.size) return;
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          idle.delete(done);
          resolve();
        };
        const timer = setTimeout(() => {
          idle.delete(done);
          reject(
            new Error(
              "Sign out could not finish because reads are still pending: " +
                [...new Set(pending.values())].sort().join(", ") +
                ". Try again.",
            ),
          );
        }, limit);
        idle.add(done);
      });
    },
  };
}

export const privateReads = createReadLifecycle();

// Bind once per document, before any resource can start. SSR owns no browser
// navigation lifecycle; a restored document retains its original binding.
export const documentReads =
  typeof window === "undefined"
    ? null
    : bindDocumentReadLifecycle(window, privateReads);
