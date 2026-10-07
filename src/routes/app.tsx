import { createFileRoute } from '@tanstack/react-router'
import { OperatorApp } from '../core/app/operator-app'
import { loadOperator } from '../core/app/loaders'
export const Route = createFileRoute('/app')({
  beforeLoad: async () => ({ operator: await loadOperator() }),
  component: OperatorApp,
})
