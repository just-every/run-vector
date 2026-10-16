import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import type { z } from 'zod'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type InitialResources = Record<string, JsonValue>
const Context = createContext<{ values: InitialResources; active: boolean } | null>(null)
const subscribeHydration = () => () => {}
const hydrated = () => true
const serverRendered = () => false
export function useHydrated() { return useSyncExternalStore(subscribeHydration, hydrated, serverRendered) }
export function resourceKey(url: string) {
  const parsed = new URL(url, 'http://vector.invalid')
  parsed.searchParams.sort()
  return parsed.pathname + parsed.search
}

/** A fresh document/navigation receipt, available only to its first mounts. */
export function InitialResourceProvider({ values, children }: { values: InitialResources; children: ReactNode }) {
  const receipt = useMemo(() => ({ values: Object.fromEntries(Object.entries(values).map(([url, value]) => [resourceKey(url), value])), active: true }), [values])
  useEffect(() => { receipt.active = false }, [receipt])
  return <Context.Provider value={receipt}>{children}</Context.Provider>
}

export function useInitialResource<S extends z.ZodType>(url: string, schema: S): z.output<S> | null {
  const receipt = useContext(Context)
  return useMemo(() => receipt?.active && Object.hasOwn(receipt.values, resourceKey(url))
    ? schema.parse(receipt.values[resourceKey(url)]) : null, [receipt, url, schema])
}
