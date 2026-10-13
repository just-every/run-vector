import { HydrationUnit } from '../../../../base/hydration/unit'
import { DocsLayout } from './docs-layout';
import { docsLead, docsSections } from './pages';

// /docs: every section and page with its one-line summary.
export function DocsIndex({ site = false }: { site?: boolean }) {
  return (
    <DocsLayout site={site}>
      <HydrationUnit>
        <article className="vx-docs-article">
          <p className="vx-docs-eyebrow">Docs</p>
          <h1>Vector docs</h1>
          <p className="vx-docs-summary">{docsLead}</p>
          {docsSections.map(section => {
            const id = `docs-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            return (
              <section className="vx-docs-index-section" key={section.title} aria-labelledby={id}>
                <h2 id={id}>{section.title}</h2>
                <ul className="vx-docs-index-list">
                  {section.pages.map(page => (
                    <li key={page.slug}>
                      <a href={`/docs/${page.slug}`}>
                        <b>{page.title}</b>
                        <span>{page.summary}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </article>
      </HydrationUnit>
    </DocsLayout>
  );
}
