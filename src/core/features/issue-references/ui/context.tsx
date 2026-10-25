import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { z } from 'zod';
import { useApiResource } from '../../../app/api-client';
import type { IssueReference } from '../schema';

const schema = z.object({ references: z.array(z.object({
  identifier: z.string(), title: z.string(),
  status: z.object({ id: z.string(), name: z.string(), category: z.string() }),
})) });
const Context = createContext<readonly IssueReference[]>([]);
export const useIssueReferences = () => useContext(Context);

export function IssueReferencesProvider({ identifier, revision, children }: {
  identifier: string; revision: number; children: ReactNode;
}) {
  const resource = useApiResource(`/api/issues/${identifier}/references`, schema, 4000, { abortPendingOnDispose: false });
  const previous = useRef({ identifier, revision });
  useEffect(() => {
    const changed = previous.current.identifier === identifier && previous.current.revision !== revision;
    previous.current = { identifier, revision };
    if (changed) resource.refreshAfterMutation();
  }, [identifier, revision, resource.refreshAfterMutation]);
  return <Context.Provider value={resource.data?.references ?? []}>
    <div style={{ display: 'contents' }}>
      {resource.error && <p role="alert">Issue references could not be refreshed. <button type="button" onClick={resource.reload}>Retry references</button></p>}
      {children}
    </div>
  </Context.Provider>;
}
