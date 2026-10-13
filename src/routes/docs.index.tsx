import { createFileRoute } from '@tanstack/react-router'
import { DocsIndex } from '../core/app/site/docs/docs-index'
import { docsHead } from '../core/app/site/docs/pages'

export const Route = createFileRoute('/docs/')({ head: () => docsHead(), component: DocsIndex })
