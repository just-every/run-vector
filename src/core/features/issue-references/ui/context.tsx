import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { createApiResourceController, fetchJson, type ResourceState } from '../../../app/api-client';
import type { IssueReference } from '../schema';

const schema = z.object({ references: z.array(z.object({
  identifier: z.string(), title: z.string(),
  status: z.object({ id: z.string(), name: z.string(), category: z.string() }),
})) });
type References = z.output<typeof schema>;
const Context = createContext<readonly IssueReference[]>([]);
export const useIssueReferences = () => useContext(Context);

export function IssueReferencesProvider({ identifier, revision, children }: {
  identifier: string; revision: number; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const currentRevision = useRef(revision);
  currentRevision.current = revision;
  const refresh = useRef<(force?: boolean) => void>(() => {});
  const [snapshot, setSnapshot] = useState<ResourceState<References> & { identifier: string }>({
    identifier, data: null, error: null, loading: false,
  });

  useEffect(() => {
    const element = root.current!;
    const controller = createApiResourceController(
      signal => fetchJson(`/api/issues/${identifier}/references`, schema, { signal }),
      state => setSnapshot({ ...state, identifier }),
    );
    let previous: string | null = null;
    let active = true, requested = false;
    let pending: Promise<void> | null = null;
    const resolve = () => {
      requested = true;
      if (pending) return;
      // Coalesce changed receipts while the admitted read drains. Check
      // visibility again before every admission, including a queued change.
      pending = (async () => {
        while (active && requested && !document.hidden) {
          requested = false;
          await controller.refresh();
        }
      })().finally(() => { pending = null; });
    };
    const read = (force = false) => {
      if (document.hidden) return;
      // Description and comment receipts can change independently: comments
      // deliberately leave the issue version unchanged. Observe their rendered
      // source text, not link decoration produced by the references response.
      const text = [...element.querySelectorAll('.issue-description .safe-markdown, .comment-body .safe-markdown')]
        .map(node => node.textContent ?? '').join('\n');
      const key = `${currentRevision.current}\0${text}`;
      if (!force && key === previous) return;
      previous = key;
      // Most inspectors contain no identifiers. No resolution read is needed
      // until a description or discussion receipt introduces a candidate.
      if (!force && !/\b[A-Z][A-Z0-9_]{0,99}-[1-9][0-9]*\b/.test(text)) {
        requested = false;
        controller.publishReceipt(() => ({ references: [] }));
        return;
      }
      resolve();
    };
    refresh.current = read;
    const observer = new MutationObserver(() => read());
    observer.observe(element, { childList: true, characterData: true, subtree: true });
    const returning = () => {
      if (document.hidden) return;
      // The existing issue-detail listener reloads its snapshot. A member's
      // description edit then reaches the observer without another poller.
      window.dispatchEvent(new Event('vector:issues-changed'));
      read(true);
    };
    window.addEventListener('focus', returning);
    document.addEventListener('visibilitychange', returning);
    read();
    return () => {
      active = false;
      refresh.current = () => {};
      observer.disconnect();
      window.removeEventListener('focus', returning);
      document.removeEventListener('visibilitychange', returning);
      void controller.dispose({ abortPending: false });
    };
  }, [identifier]);

  useEffect(() => { refresh.current(); }, [revision]);
  const current = snapshot.identifier === identifier ? snapshot : null;
  return <Context.Provider value={current?.data?.references ?? []}>
    <div ref={root} style={{ display: 'contents' }}>
      {current?.error && <p role="alert">Issue references could not be refreshed. <button type="button" onClick={() => refresh.current(true)}>Retry references</button></p>}
      {children}
    </div>
  </Context.Provider>;
}
