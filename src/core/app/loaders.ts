import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import type { WorkerBindings } from './bindings'
export const loadOperator = createServerFn({ method: 'GET' }).inputValidator((href: string) => href).handler(
  async ({ data: href }) => {
    const { currentOperator } = await import('./request.server')
    const operator = await currentOperator()
    if (!operator) throw redirect({ to: '/signin' })
    const { env } = await import('cloudflare:workers')
    const bindings = env as WorkerBindings
    if (operator.setupCompleted == null) throw Error('Workspace is unavailable')
    if (!operator.setupCompleted) throw redirect({ to: '/setup' })
    const { pageResources } = await import('./page-resources.server')
    const { getRequest } = await import('@tanstack/react-start/server')
    const { readAppearance } = await import('../features/settings/appearance')
    const [resources, appearance] = await Promise.all([
      pageResources(bindings, getRequest(), operator, href), readAppearance(bindings.DB, operator.id)])
    return { id: operator.id, name: operator.name, resources, theme: appearance.theme,
      editorConfigured: Boolean(bindings.RER_MANAGEMENT_ORIGIN && bindings.RER_INSTALLATION_ID) }
  },
)
