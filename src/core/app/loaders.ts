import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
export const loadOperator = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { currentOperator } = await import('./request.server')
    const operator = await currentOperator()
    if (!operator) throw redirect({ to: '/signin' })
    return { id: operator.id, name: operator.name }
  },
)
