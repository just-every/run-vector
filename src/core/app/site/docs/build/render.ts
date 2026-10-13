import { Marked } from 'marked';
import { posix } from 'node:path';
import type { DocsTocEntry } from '../types.ts';
import { createSlugger } from './slug.ts';

// One Markdown page to static HTML, at build time. Raw HTML in the Markdown is shown as text, never passed through. The
// page title comes from docs/site.json, so a leading level-1 heading is dropped and any other one is a problem. Headings
// get GitHub-style ids and the h2s and h3s become the contents list. Code blocks become the code card, focusable so a keyboard can scroll them. Tables scroll
// inside a focusable region. Links are written for GitHub (relative paths between Markdown files) and rewritten here: a
// published page becomes /docs/<slug>, any other file in the repository becomes its GitHub address.

export type LinkContext = {
  /** The page's Markdown source, from the repository root. */
  source: string;
  /** Published Markdown sources and their /docs/<slug> address. */
  published: Map<string, string>;
  /** Whether a repository path exists, and as what. */
  kind: (path: string) => 'file' | 'directory' | null;
  repository: string;
};
/** A link into another published page (or this one), checked against its headings once every page is rendered. */
export type Anchor = { href: string; slug: string | null; id: string };
export type RenderedPage = { html: string; toc: DocsTocEntry[]; ids: string[]; anchors: Anchor[]; problems: string[] };

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const decodeHtml = (value: string) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

const languageNames: Record<string, string> = {
  sh: 'Shell', bash: 'Shell', shell: 'Shell', console: 'Shell', json: 'JSON', js: 'JavaScript', ts: 'TypeScript', text: 'Text',
};

/** Where a link written in `context.source` goes on the site, or the problem with it. */
function resolve(href: string, context: LinkContext): { href: string; anchor?: Anchor } | { problem: string } {
  if (/^(?:https?:|mailto:)/i.test(href)) return { href };
  const [path, id] = href.split('#') as [string, string | undefined];
  if (!path) return id ? { href, anchor: { href, slug: null, id } } : { problem: `links to "${href}"` };
  if (path.startsWith('/')) return { problem: `links to ${href}; write repository links as relative paths, the way GitHub reads them` };
  const target = posix.normalize(posix.join(posix.dirname(context.source), path)).replace(/\/$/, '');
  if (target.startsWith('..')) return { problem: `links to ${href}, outside the repository` };
  const page = context.published.get(target);
  if (page) return { href: page + (id ? `#${id}` : ''), anchor: id ? { href, slug: page.slice('/docs/'.length), id } : undefined };
  const kind = context.kind(target);
  if (!kind) return { problem: `links to ${href}, but ${target} does not exist` };
  return { href: `${context.repository}/${kind === 'directory' ? 'tree' : 'blob'}/main/${target}${id ? `#${id}` : ''}` };
}

export function renderMarkdown(markdown: string, context: LinkContext): RenderedPage {
  const slug = createSlugger();
  const toc: DocsTocEntry[] = [];
  const ids: string[] = [];
  const anchors: Anchor[] = [];
  const problems: string[] = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        if (depth === 1) {
          problems.push('has a level-1 heading after its first line; the page title comes from docs/site.json');
          return '';
        }
        const text = collapse(decodeHtml(this.parser.parseInline(tokens, this.parser.textRenderer)));
        const id = slug(text);
        ids.push(id);
        if (depth === 2 || depth === 3) toc.push({ depth, id, text });
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const language = (lang ?? '').trim().split(/\s+/)[0].toLowerCase();
        if (!language) problems.push('has a code block without a language');
        const name = languageNames[language] ?? language.toUpperCase();
        const head = `<div class="vx-docs-code-head"><span>${escapeHtml(name || 'Code')}</span></div>`;
        return `<div class="vx-docs-code">${head}<pre tabindex="0"><code>${escapeHtml(text.replace(/\n$/, ''))}</code></pre></div>\n`;
      },
      // Inline code wraps only between its words, never inside a flag, path or name.
      codespan({ text }) {
        return `<code>${text.split(' ').map(word => word && `<span>${escapeHtml(word)}</span>`).join(' ')}</code>`;
      },
      html({ text }) {
        return escapeHtml(text);
      },
      link({ href, title, tokens }) {
        const label = this.parser.parseInline(tokens);
        const result = resolve(href, context);
        if ('problem' in result) {
          problems.push(result.problem);
          return label;
        }
        if (result.anchor) anchors.push(result.anchor);
        const external = /^https?:/i.test(result.href);
        const titled = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(result.href)}"${titled}${external ? ' rel="noreferrer"' : ''}>${label}</a>`;
      },
      image({ href }) {
        problems.push(`has an image (${href}); the docs publish text only`);
        return '';
      },
    },
  });
  // The first line's level-1 heading is the file's title on GitHub; the site shows the manifest's title instead.
  const body = markdown.replace(/^# [^\n]*\n+/, '');
  const html = (marked.parse(body, { async: false }) as string)
    .replace(/<table>/g, '<div class="vx-docs-table" role="region" tabindex="0" aria-label="Table"><table>')
    .replace(/<\/table>/g, '</table></div>');
  return { html, toc, ids, anchors, problems };
}
