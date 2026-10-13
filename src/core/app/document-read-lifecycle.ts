type DocumentNavigationEvent = Event & {
  destination: { sameDocument: boolean };
  signal: AbortSignal;
  downloadRequest: string | null;
};

type DocumentReadHost = EventTarget & {
  navigation?: EventTarget & {
    transition?: { finished: Promise<unknown> } | null;
  };
  location: { reload(): void };
};
type ReadAdmission = { hold(): () => void; readonly manuallyPaused: boolean };

// Navigation's per-event abort signal covers cancellation after its event,
// supersession and failure. A persisted pageshow is
// the browser's explicit receipt that this document was restored from BFCache.
// Same-document history changes keep their ordinary resource lifecycle.
export function bindDocumentReadLifecycle(
  host: EventTarget,
  reads: ReadAdmission,
) {
  const navigation = (host as DocumentReadHost).navigation;
  const active = new Map<() => void, AbortSignal | undefined>();
  let beforeUnloadRelease: (() => void) | null = null;
  let reloadRelease: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const hold = (signal?: AbortSignal) => {
    const reopen = reads.hold();
    const release = () => {
      signal?.removeEventListener("abort", cancel);
      if (!active.delete(release)) return;
      if (beforeUnloadRelease === release) beforeUnloadRelease = null;
      if (reloadRelease === release) reloadRelease = null;
      reopen();
      notify();
    };
    // Supersession aborts the old event before announcing the new navigation.
    const cancel = () => queueMicrotask(release);
    active.set(release, signal);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    notify();
    return release;
  };
  const restore = () => {
    for (const release of active.keys()) release();
  };
  const navigate = (raw: Event) => {
    const event = raw as DocumentNavigationEvent;
    if (event.destination.sameDocument || event.downloadRequest !== null)
      return;
    const release = hold(event.signal);
    // Some navigation paths announce beforeunload first. Transfer that fence
    // to the observable attempt without opening admission between owners.
    beforeUnloadRelease?.();
    // Interception can convert a document destination into an in-document
    // transition. Capture that transition's completion, never a later global
    // success event which might belong to an unrelated history change.
    queueMicrotask(() => {
      if (!event.signal.aborted)
        navigation?.transition?.finished.then(release, release);
    });
  };
  // Browser/address-bar navigation does not emit Navigation API events.
  // beforeunload is its admission fence, not proof that navigation committed.
  // If no later browser receipt arrives, the operator can request a fresh
  // document. The old document never reopens admission on that request alone.
  const beforeunload = () => {
    if (![...active.values()].some((signal) => !signal?.aborted))
      beforeUnloadRelease = hold();
  };
  const pageshow = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) restore();
  };
  navigation?.addEventListener("navigate", navigate);
  host.addEventListener("pageshow", pageshow);
  host.addEventListener("beforeunload", beforeunload);
  return {
    get pending() {
      return active.size > 0;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reload() {
      if (reads.manuallyPaused || !active.size) return;
      // A failed replacement must not reopen the outgoing document after the
      // operator chose a fresh one. Only restoration/new-document admission
      // can recover this fence, independently of per-attempt cancellation.
      reloadRelease ??= hold();
      (host as DocumentReadHost).location.reload();
    },
    dispose() {
      navigation?.removeEventListener("navigate", navigate);
      host.removeEventListener("pageshow", pageshow);
      host.removeEventListener("beforeunload", beforeunload);
      restore();
    },
  };
}
