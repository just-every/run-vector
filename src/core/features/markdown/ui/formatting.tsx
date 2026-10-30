import { useState, type ReactNode } from 'react';
import hljs from 'highlight.js';
import './formatting.css';

type Node = { type: string; value?: string; children?: Node[]; data?: Record<string, unknown>; tagName?: string; properties?: Record<string, unknown> };
/** A text directive creates native details/summary without admitting raw HTML. */
export function remarkDetails() {
  return (tree: Node) => {
    function visit(parent: Node) {
      if (!parent.children) return;
      const result: Node[] = [];
      for (let i = 0; i < parent.children.length; i++) {
        const node = parent.children[i]!;
        const text = node.type === 'paragraph' && node.children?.length === 1 && node.children[0]?.type === 'text' ? node.children[0].value : undefined;
        const start = text?.match(/^:::details(?: (.+))?$/);
        if (start) {
          const end = parent.children.findIndex((n, index) => index > i && n.type === 'paragraph' && n.children?.length === 1 && n.children[0]?.value === ':::');
          if (end > i) {
            result.push({ type: 'container', data: { hName: 'details' }, children: [
              { type: 'paragraph', data: { hName: 'summary' }, children: [{ type: 'text', value: start[1] || 'Details' }] },
              ...parent.children.slice(i + 1, end),
            ] });
            i = end;
            continue;
          }
        }
        visit(node);
        result.push(node);
      }
      parent.children = result;
    }
    visit(tree);
  };
}

/** Indices follow the parsed Markdown task order, including nested tasks. */
export function rehypeTaskIndices() {
  return (tree: Node) => {
    let index = 0;
    function visit(node: Node) {
      if (node.tagName === 'input' && node.properties?.type === 'checkbox') {
        node.properties['data-task-index'] = index++;
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}

export function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return <div className="markdown-code"><button type="button" onClick={async event => {
    const code = event.currentTarget.parentElement?.querySelector('code')?.textContent;
    if (code === undefined) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); } catch { setCopied(false); }
  }}>{copied ? 'Copied' : 'Copy code'}</button><pre tabIndex={0}>{children}</pre></div>;
}
export function HighlightedCode({ className, children, sourceAttributes }: { className?: string; children: ReactNode; sourceAttributes?: Record<string, unknown> }) {
  const language = className?.match(/language-([\w#+-]+)/)?.[1];
  const text = String(children ?? '');
  if (!language || !hljs.getLanguage(language)) return <code {...sourceAttributes} className={className}>{children}</code>;
  // highlight.js escapes source before adding its own fixed span classes.
  const html = hljs.highlight(text, { language, ignoreIllegals: true }).value;
  return <code {...sourceAttributes} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
