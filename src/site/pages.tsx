import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../core/app/identity'
import { HomePage } from '../core/app/site/home/home-page'
import { hero, meta } from '../core/app/site/home/copy/hero'
import { DocsIndex } from '../core/app/site/docs/docs-index'
import { DocsArticle } from '../core/app/site/docs/docs-article'
import { docsLead, docsPages } from '../core/app/site/docs/pages'
import { documentHtml } from './document'
import { run } from './run'
import '../core/app/app.css'

export function sitePages({ styles, contract }: SiteContext): SiteBuild {
  return {
    pages: [
      { path: '/', html: documentHtml(`Vector — ${hero.title}`, meta.description, <HomePage site />, styles) },
      { path: '/run', html: runPageHtml(identity, run, contract) },
      ...(contract ? [{ path: '/contract', html: contractPageHtml(identity, run, contract) }] : []),
      { path: '/docs', html: documentHtml('Docs · Vector', docsLead, <DocsIndex site />, styles) },
      ...docsPages.map(page => ({ path: `/docs/${page.slug}`, html: documentHtml(`${page.title} · Vector docs`, page.summary, <DocsArticle slug={page.slug} site />, styles) })),
      { path: '/404', html: siteNotFoundHtml(identity, run, contract) },
    ],
    assets: ['rer-theme.css', 'fonts', 'brand', 'favicon.svg'],
  }
}
