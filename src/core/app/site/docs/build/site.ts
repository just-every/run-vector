import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { links } from '../../shell/links.ts';
import type { DocsBody, DocsSection } from '../types.ts';
import { manifestPath, readManifest } from './manifest.ts';
import { renderMarkdown } from './render.ts';

// The whole docs site from the tree as it is: every page in docs/site.json rendered, every link resolved and every
// anchor into a published page checked, and nothing that names a build machine's paths. Any problem fails the build with
// the full list.

export type DocsSite = { sections: DocsSection[]; bodies: Record<string, DocsBody>; files: string[] };

/** An absolute path on the build machine must never reach a published page. */
const machinePath = /(?<![\w.@~-])\/(?:Users|home|private|tmp|var|Volumes|root)\/[^\s"'`<\\]*/g;

export function buildDocs(root: string): DocsSite {
  const { sections } = readManifest(root);
  const pages = sections.flatMap(section => section.pages);
  const published = new Map(pages.map(page => [page.source, `/docs/${page.slug}`]));
  const kind = (path: string) => !existsSync(join(root, path)) ? null : statSync(join(root, path)).isDirectory() ? 'directory' as const : 'file' as const;
  const files = [join(root, manifestPath)];
  const rendered = new Map(pages.map(page => {
    files.push(join(root, page.source));
    return [page.slug, renderMarkdown(readFileSync(join(root, page.source), 'utf8'), { source: page.source, published, kind, repository: links.source })] as const;
  }));
  const problems: string[] = [];
  for (const page of pages) {
    const { html, anchors, problems: own } = rendered.get(page.slug)!;
    const report = (problem: string) => problems.push(`${page.source}: ${problem}`);
    own.forEach(report);
    for (const anchor of anchors) {
      if (!rendered.get(anchor.slug ?? page.slug)!.ids.includes(anchor.id)) report(`links to ${anchor.href}, which is not a heading there`);
    }
    for (const leak of new Set(html.match(machinePath) ?? [])) report(`contains ${leak}, a build machine path`);
  }
  if (problems.length) throw new Error(`Docs: ${problems.length} problem(s) in the Markdown:\n- ${problems.join('\n- ')}`);
  const bodies = Object.fromEntries(pages.map(page => {
    const { html, toc } = rendered.get(page.slug)!;
    return [page.slug, { html, toc }];
  }));
  return { sections, bodies, files };
}
