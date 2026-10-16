import { createFileRoute } from '@tanstack/react-router'
import { OperatorApp } from '../core/app/operator-app'
import { loadOperator } from '../core/app/loaders'
import { takeNavigationReceipt } from '../core/app/navigation-receipt'
export const Route = createFileRoute('/app')({
  beforeLoad: async ({ location }) => ({ operator: takeNavigationReceipt(location.href) ?? await loadOperator({ data: location.href }) }),
  head: () => ({ links: [
    { rel: 'preload', href: '/fonts/brand/instrument-sans-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
    { rel: 'preload', href: '/fonts/brand/ibm-plex-mono-latin-500-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  ] }),
  component: OperatorApp,
})
