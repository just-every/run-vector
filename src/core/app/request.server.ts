import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'
import { requireOperator } from '../features/auth/service'
import type { WorkerBindings } from './bindings'
export async function currentOperator() {
  return requireOperator((env as unknown as WorkerBindings), getRequest())
}
