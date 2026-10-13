import { createFileRoute, notFound } from '@tanstack/react-router'
import { DocsArticle } from '../core/app/site/docs/docs-article'
import { docsHead, hasDocsPage } from '../core/app/site/docs/pages'

export const Route = createFileRoute('/docs/$slug')({
  beforeLoad: ({ params }) => { if (!hasDocsPage(params.slug)) throw notFound() },
  head: ({ params }) => docsHead(params.slug),
  component: () => { const { slug } = Route.useParams(); return <DocsArticle slug={slug} /> },
})
