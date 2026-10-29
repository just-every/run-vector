import { useEffect, useRef, useState, type ReactNode } from 'react';
import { codePointOffset, quoteAt, textBoundaries, type DescriptionAnchor, type DescriptionAnchorInput } from '../../discussion/anchors';
import { MentionTextarea } from '../../notifications/ui/mention-textarea';
import { ReactionProvider } from '../../reactions/ui';
import { useHydrated } from '../../../app/initial-resources';
import { CommentThread, commentThreads } from './discussion-thread';
import { useDiscussion } from './discussion-client';
import './description-discussion.css';

/** Read only a selection wholly inside annotated description text. */
function selectionAnchor(container: HTMLElement, source: string): DescriptionAnchorInput | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  function boundary(node: Node, offset: number) {
    const element = (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement)?.closest<HTMLElement>('[data-description-start]');
    if (!element || !container.contains(element)) return null;
    const prefix = document.createRange();
    prefix.selectNodeContents(element);
    prefix.setEnd(node, offset);
    const start = Number(element.dataset.descriptionStart), end = Number(element.dataset.descriptionEnd);
    const literalLength = element.dataset.descriptionLiteral === undefined ? null : Number(element.dataset.descriptionLiteral);
    const text = literalLength === null ? element.textContent ?? '' : (element.textContent ?? '').slice(0, literalLength);
    return textBoundaries(source, start, end, text, literalLength !== null)?.[Math.min(prefix.toString().length, text.length)] ?? null;
  }
  const a = boundary(range.startContainer, range.startOffset), b = boundary(range.endContainer, range.endOffset);
  if (a === null || b === null || a >= b || !range.toString().trim()) return null;
  const start = codePointOffset(source, a), end = codePointOffset(source, b), quote = quoteAt(source, start, end);
  return quote.trim() ? { quote, start, end, expectedDescription: source } : null;
}

function locateQuote(container: HTMLElement, source: string, anchor: DescriptionAnchor) {
  const points = Array.from(source), start = points.slice(0, anchor.start).join('').length, end = points.slice(0, anchor.end).join('').length;
  function boundary(offset: number) {
    for (const element of container.querySelectorAll<HTMLElement>('[data-description-start]')) {
      const a = Number(element.dataset.descriptionStart), b = Number(element.dataset.descriptionEnd);
      const literal = element.dataset.descriptionLiteral;
      const text = literal === undefined ? element.textContent ?? '' : (element.textContent ?? '').slice(0, Number(literal));
      const index = textBoundaries(source, a, b, text, literal !== undefined)?.indexOf(offset) ?? -1;
      if (index < 0) continue;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let remaining = index, node: Node | null;
      while ((node = walker.nextNode())) {
        const length = node.textContent?.length ?? 0;
        if (remaining <= length) return {node, offset:remaining, element};
        remaining -= length;
      }
    }
    return null;
  }
  const a = boundary(start), b = boundary(end);
  if (!a || !b) return;
  const range = document.createRange();
  range.setStart(a.node, a.offset); range.setEnd(b.node, b.offset);
  const selection = window.getSelection();
  selection?.removeAllRanges(); selection?.addRange(range);
  a.element.scrollIntoView({block:'center'});
}

export function DescriptionDiscussion({ identifier, description, version, writable, onRefresh, children }: {
  identifier: string; description: string; version: number; writable: boolean; onRefresh: () => void; children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null), previousVersion = useRef(version);
  const [selection, setSelection] = useState<DescriptionAnchorInput | null>(null),
    [draft, setDraft] = useState<DescriptionAnchorInput | null>(null), [body, setBody] = useState('');
  const { resource, busy, error, mutate } = useDiscussion(identifier, onRefresh), hydrated = useHydrated();
  useEffect(() => {
    if (previousVersion.current !== version) {
      previousVersion.current = version;
      resource.refreshAfterMutation();
      setSelection(null);
    }
  }, [version, resource.refreshAfterMutation]);
  useEffect(() => {
    const select = () => {
      if (container.current && writable) {
        const next = selectionAnchor(container.current, description);
        // Keep the selected quote while its labelled action takes focus.
        if (next) setSelection(next);
      }
    };
    document.addEventListener('selectionchange', select);
    return () => document.removeEventListener('selectionchange', select);
  }, [description, writable]);
  const threads = commentThreads(resource.data?.comments ?? []).filter(({ root }) => root.anchor);
  return <div className="description-discussion">
    <div className="description-source" ref={container}>{children}
      {writable && description && <button type="button" disabled={!selection || busy || !hydrated} onClick={() => { setDraft(selection); setSelection(null); }}>
        Comment on selection
      </button>}
    </div>
    {(threads.length > 0 || draft || error || resource.error) && <aside className="description-thread-margin" aria-label="Description threads">
      <h2>Description threads</h2>
      <ReactionProvider identifier={identifier}>{threads.map(({ root, replies }) => <CommentThread key={root.id} root={root} replies={replies}
        onLocateQuote={anchor => { if(container.current) locateQuote(container.current, description, anchor); }}
        writable={writable} identifier={identifier} data={resource.data!} busy={busy} mutate={mutate}
        onLinksChanged={() => { resource.refreshAfterMutation(); onRefresh(); }} />)}</ReactionProvider>
      {draft && <form className="issue-mutation-form comment-composer" onSubmit={event => {
        event.preventDefault();
        void mutate('comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body, anchor: draft }) }, () => { setDraft(null); setBody(''); });
      }}>
        <blockquote>{draft.quote}</blockquote>
        <label>Comment on quoted text<MentionTextarea aria-label="Comment on quoted text" required maxLength={100000} disabled={busy || !hydrated} value={body} onValueChange={setBody}/></label>
        <button disabled={busy || !hydrated}>Start thread</button>
        <button type="button" disabled={busy} onClick={() => { setDraft(null); setBody(''); }}>Cancel</button>
      </form>}
      {error && <p role="alert">{error}</p>}
      {resource.error && <p role="alert">{resource.error.message} <button type="button" onClick={resource.reload}>Retry description threads</button></p>}
    </aside>}
  </div>;
}
