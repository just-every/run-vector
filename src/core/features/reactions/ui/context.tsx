import { createContext, useContext, useState, type ReactNode } from 'react';
import { fetchJson, useApiResource } from '../../../app/api-client';
import { useHydrated } from '../../../app/initial-resources';
import { reactionProjectionSchema } from '../schema';
import type { z } from 'zod';

type Projection = z.output<typeof reactionProjectionSchema>;
type State = { data: Projection | null; busy: boolean; error: string; ready: boolean; retry: () => void;
  change: (subjectId: string, emoji: string, present: boolean) => Promise<boolean> };
const Context = createContext<State | null>(null);
export function ReactionsProvider({ identifier, children }: { identifier: string; children: ReactNode }) {
  const path = `/api/issues/${identifier}/reactions`;
  const resource = useApiResource(path, reactionProjectionSchema, 2500, { abortPendingOnDispose: false });
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function change(subjectId: string, emoji: string, present: boolean) {
    if (busy || !resource.data?.canReact || !hydrated) return false;
    setBusy(true); setError('');
    try {
      const receipt = await fetchJson(path, reactionProjectionSchema, { method: present ? 'PUT' : 'DELETE',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subjectId, emoji }) });
      resource.publishReceipt(() => receipt);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The reaction could not be saved.'); return false; }
    finally { setBusy(false); }
  }
  return <Context.Provider value={{ data: resource.data, busy, error: error || resource.error?.message || '',
    ready: hydrated && !!resource.data, retry: resource.reload, change }}>{children}</Context.Provider>;
}
export function useReactions() {
  const state = useContext(Context);
  if (!state) throw new Error('Reaction controls require their issue provider.');
  return state;
}
