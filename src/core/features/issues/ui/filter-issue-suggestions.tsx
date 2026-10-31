import { useEffect, useId, useState, type ReactNode } from 'react';
import type { WorkspaceOptions } from '../../../shared/workspace-options';
import { useApiResource } from '../../../app/api-client';
import { workspaceSearchSchema } from '../../search/ui/data';
import { expressionSuggestions } from './filter-suggestions';

const issueFields = ['parent', 'related', 'blocks', 'blockedby', 'duplicateof', 'duplicates'];
export const isIssueOperand = (field: string) => issueFields.includes(field);
/** Find the current term outside quoted text; never reinterpret a prior group. */
function issueFragment(source: string) {
  let start = 0, quoted = false, escaped = false;
  for (let n = 0; n < source.length; n++) {
    const char = source[n];
    if (escaped) { escaped = false; continue; }
    if (quoted && char === '\\') { escaped = true; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (char === '(') start = n + 1;
    const connector = source.slice(n).match(/^(?:AND|OR|NOT)\s+/i);
    if (connector && (n === 0 || /[\s(]/.test(source[n - 1]))) { start = n + connector[0].length; n = start - 1; }
  }
  const term = source.slice(start), leading = term.length - term.trimStart().length;
  const match = term.trimStart().match(/^(parent|related|blocks|blockedby|duplicateof|duplicates)(=|!=)(.*)$/i);
  if (!match) return null;
  const query = match[3].replace(/^"|"$/g, '').trim();
  if (!query || query === 'none' || query.length > 200) return null;
  return { query, prefix: source.slice(0, start + leading) + match[1].toLowerCase() + match[2] };
}
function SearchSuggestions({ id, query, prefix, children }: { id: string; query: string; prefix: string; children?: ReactNode }) {
  const [requested, setRequested] = useState(query);
  useEffect(() => { const timer = window.setTimeout(() => setRequested(query), 200); return () => window.clearTimeout(timer); }, [query]);
  const search = useApiResource('/api/search?' + new URLSearchParams({ q: requested }), workspaceSearchSchema, 4000, { abortPendingOnDispose: false });
  return <>
    <datalist id={id}>{children}{requested === query && search.data?.issues.map(issue => <option key={issue.id} value={prefix + issue.identifier}>{issue.identifier + ' · ' + issue.title}</option>)}</datalist>
    {requested === query && search.error && <span role="status">Issue suggestions are unavailable. {search.error.message}</span>}
  </>;
}
export function FilterExpressionSuggestions({ id, draft, options }: { id: string; draft: string; options: WorkspaceOptions | null }) {
  const lookup = issueFragment(draft);
  const choices = expressionSuggestions(draft, options).map(term => <option key={term.value} value={term.value}>{term.label}</option>);
  return lookup ? <SearchSuggestions id={id} {...lookup}>{choices}</SearchSuggestions> : <datalist id={id}>{choices}</datalist>;
}
export function IssueOperandInput({ value, path, onChange }: { value: string; path: string; onChange: (value: string) => void }) {
  const hints = useId(), query = value.trim();
  return <>
    <input aria-label={`Value ${path}`} list={hints} maxLength={200} value={value} onChange={event => onChange(event.target.value)} placeholder="Search a visible issue or use none"/>
    {query && query !== 'none' ? <SearchSuggestions id={hints} query={query} prefix=""><option value="none">No linked issue</option></SearchSuggestions>
      : <datalist id={hints}><option value="none">No linked issue</option></datalist>}
  </>;
}
