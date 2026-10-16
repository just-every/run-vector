import { AsyncLocalStorage } from 'node:async_hooks'
import type { requireOperator } from '../features/auth/service'

type Operator = Awaited<ReturnType<typeof requireOperator>>
const documentOperator = new AsyncLocalStorage<{ operator: Operator }>()
export function renderAsOperator<T>(operator: Operator, render: () => T): T {
  return documentOperator.run({ operator }, render)
}
export function admittedDocumentOperator() { return documentOperator.getStore() }
