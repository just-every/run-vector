import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'
import { requireOperator } from '../features/auth/service'
import type { WorkerBindings } from './bindings'
import { admittedDocumentOperator } from './document-operator.server'
export async function currentOperator() {
  const document = admittedDocumentOperator()
  if (document) return document.operator
  return requireOperator((env as unknown as WorkerBindings), getRequest(), true)
}
