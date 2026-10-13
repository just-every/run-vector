import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import type { WorkerBindings } from './bindings'
export const loadOperator = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { currentOperator } = await import('./request.server')
    const operator = await currentOperator()
    if (!operator) throw redirect({ to: '/signin' })
    const { env } = await import('cloudflare:workers')
    const bindings = env as WorkerBindings
    const { firstRunState } = await import('../features/first-run/repository')
    if (!(await firstRunState(env.DB, operator.id)).completed) throw redirect({ to: '/setup' })
    return { id: operator.id, name: operator.name,
      editorConfigured: Boolean(bindings.RER_MANAGEMENT_ORIGIN && bindings.RER_INSTALLATION_ID) }
  },
)
