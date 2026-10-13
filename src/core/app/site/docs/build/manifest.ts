import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { DocsSection } from '../types.ts';

// docs/site.json is the one list of what the site publishes from the repository's Markdown, in display order, and of
// what stays on GitHub with the reason it is not for owners. Each page names its slug, title, Markdown source (a path
// from the repository root) and a one-sentence summary. Every Markdown file Git tracks is either published or listed in
// githubOnly, so a new file is classified on purpose. This reads it and enforces the rules; every problem at once.

export const manifestPath = 'docs/site.json';
export type GithubOnlyEntry = { source: string; reason: string };
export type Manifest = { sections: DocsSection[]; githubOnly: GithubOnlyEntry[] };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const isFile = (root: string, source: string) => existsSync(join(root, source)) && statSync(join(root, source)).isFile();

/** The Markdown files Git tracks, or null outside a Git work tree (a source archive has no index to check against). */
function trackedMarkdown(root: string): string[] | null {
  try {
    return execFileSync('git', ['ls-files', '-z', '--', '*.md'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

export function readManifest(root: string): Manifest {
  const raw = JSON.parse(readFileSync(join(root, manifestPath), 'utf8'));
  const problems: string[] = [];
  const slugs = new Set<string>();
  const sources = new Set<string>();
  const useSource = (source: string, where: string) => {
    if (!source.endsWith('.md') || source.startsWith('/') || source.split('/').includes('..')) problems.push(`${where}: "${source}" must be a Markdown path from the repository root`);
    else if (!isFile(root, source)) problems.push(`${where}: ${source} does not exist`);
    if (sources.has(source)) problems.push(`${where}: ${source} is listed twice`);
    sources.add(source);
  };
  const sections: DocsSection[] = (Array.isArray(raw?.sections) ? raw.sections : []).map((section: Record<string, unknown>, s: number) => {
    const title = text(section.title);
    if (!title) problems.push(`section ${s + 1} has no title`);
    const entries: Record<string, unknown>[] = Array.isArray(section.pages) ? section.pages : [];
    if (!entries.length) problems.push(`section "${title}" has no pages`);
    return {
      title,
      pages: entries.map((page, p) => {
        const where = `page ${p + 1} of "${title}"`;
        const slug = text(page.slug), pageTitle = text(page.title), source = text(page.source), summary = text(page.summary);
        if (!slugPattern.test(slug)) problems.push(`${where}: slug "${slug}" must be lowercase words joined by hyphens`);
        if (slugs.has(slug)) problems.push(`${where}: slug "${slug}" is used twice`);
        slugs.add(slug);
        if (!pageTitle) problems.push(`${where}: no title`);
        if (!summary) problems.push(`${where}: no summary`);
        useSource(source, where);
        return { slug, title: pageTitle, source, summary, section: title };
      }),
    };
  });
  if (!sections.length) problems.push('no sections');
  const githubOnly: GithubOnlyEntry[] = (Array.isArray(raw?.githubOnly) ? raw.githubOnly : []).map((entry: Record<string, unknown>, index: number) => {
    const source = text(entry.source), reason = text(entry.reason);
    useSource(source, `githubOnly entry ${index + 1}`);
    if (!reason) problems.push(`githubOnly entry "${source}" has no reason`);
    return { source, reason };
  });
  for (const source of trackedMarkdown(root) ?? []) {
    if (!sources.has(source)) problems.push(`${source} is neither a page nor in githubOnly; add it to one with a reason`);
  }
  if (problems.length) throw new Error(`${manifestPath} is invalid:\n- ${problems.join('\n- ')}`);
  return { sections, githubOnly };
}
