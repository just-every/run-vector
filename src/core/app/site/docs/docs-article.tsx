import { HydrationUnit } from '../../../../base/hydration/unit'
import { links } from '../shell/links';
import { DocsLayout } from './docs-layout';
import { docsNeighbours, getDocsPage } from './pages';

// One docs page: section, title, the rendered Markdown (its first paragraph is the lead), then the next page.
export function DocsArticle({ slug, site = false }: { slug: string; site?: boolean }) {
  const page = getDocsPage(slug)!;
  const { previous, next } = docsNeighbours(slug);
  const toc = page.toc.filter(entry => entry.depth === 2);
  return (
    <DocsLayout
      site={site}
      current={slug}
      aside={toc.length > 1 && (
        <nav className="vx-docs-toc" aria-label="On this page">
          <p>On this page</p>
          <ul>{toc.map(entry => <li key={entry.id}><a href={`#${entry.id}`}>{entry.text}</a></li>)}</ul>
        </nav>
      )}
    >
      <HydrationUnit>
        <article className="vx-docs-article">
          <p className="vx-docs-eyebrow">{page.section}</p>
          <h1>{page.title}</h1>
          <div className="vx-docs-body" dangerouslySetInnerHTML={{ __html: page.html }} />
        </article>
      </HydrationUnit>
      <HydrationUnit>
        <nav className="vx-docs-pager" aria-label="Previous and next">
          {previous ? <a href={`/docs/${previous.slug}`} rel="prev"><small>Previous</small><span>{previous.title}</span></a> : <span />}
          {next ? <a className="vx-docs-pager-next" href={`/docs/${next.slug}`} rel="next"><small>Next</small><span>{next.title}</span></a> : null}
        </nav>
      </HydrationUnit>
      <HydrationUnit>
        <p className="vx-docs-source"><a className="vx-link" href={`${links.source}/blob/main/${page.source}`}>Edit this page on GitHub</a></p>
      </HydrationUnit>
    </DocsLayout>
  );
}
