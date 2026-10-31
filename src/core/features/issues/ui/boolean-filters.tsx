import type { WorkspaceOptions } from '../../../shared/workspace-options';
import { FilterExpressionSuggestions } from './filter-issue-suggestions';
import { TermControls } from './filter-term-controls';
import { useEffect, useId, useRef, useState } from 'react';
import { expressionDepth, expressionLimit, formatFilterExpression, parseFilterExpression, priorities, type FilterExpression, type Priority } from '../filter-expression';

const initial = (): FilterExpression => ({ kind: 'priority', value: 'high' });
function condition(kind: FilterExpression['kind']): FilterExpression {
  if (kind === 'priority') return initial();
  if (kind === 'term') return { kind, field: 'category', operator: '=', value: 'backlog' };
  if (kind === 'blocked') return { kind };
  if (kind === 'not') return { kind, child: { kind: 'blocked' } };
  return { kind, left: initial(), right: initial() };
}
function Condition({ value, onChange, path = '1', depth = 0, options }: {
  value: FilterExpression; onChange: (value: FilterExpression) => void; path?: string; depth?: number; options: WorkspaceOptions | null;
}) {
  return <fieldset className="boolean-condition">
    <legend>Condition {path}</legend>
    <label>Match
      <select aria-label={`Condition ${path}`} value={value.kind} onChange={event => onChange(condition(event.target.value as FilterExpression['kind']))}>
        <option value="priority">Priority</option><option value="blocked">Blocked</option><option value="term">Field comparison</option>
        {(depth < expressionDepth || ['and', 'or', 'not'].includes(value.kind)) && <>
          <option value="and">All (AND)</option><option value="or">Any (OR)</option><option value="not">Not (NOT)</option>
        </>}
      </select>
    </label>
    {value.kind === 'priority' && <label>Priority
      <select aria-label={`Priority ${path}`} value={value.value} onChange={event => onChange({ kind: 'priority', value: event.target.value as Priority })}>
        {priorities.map(priority => <option key={priority} value={priority}>{priority === 'none' ? 'No priority' : priority[0].toUpperCase() + priority.slice(1)}</option>)}
      </select>
    </label>}
    {value.kind === 'term' && <TermControls value={value} onChange={onChange} path={path} options={options}/>}
    {value.kind === 'not' && <Condition options={options} value={value.child} depth={depth + 1} path={path + '.1'} onChange={child => onChange({ ...value, child })}/>}
    {(value.kind === 'and' || value.kind === 'or') && <>
      <Condition options={options} value={value.left} depth={depth + 1} path={path + '.1'} onChange={left => onChange({ ...value, left })}/>
      <Condition options={options} value={value.right} depth={depth + 1} path={path + '.2'} onChange={right => onChange({ ...value, right })}/>
    </>}
  </fieldset>;
}
export function BooleanFilters({ value, onChange, options }: { value: string; onChange: (expression: string) => void; options: WorkspaceOptions | null }) {
  const [draft, setDraft] = useState(value), [error, setError] = useState('');
  const [open, setOpen] = useState(!!value);
  const [tree, setTree] = useState(() => parseFilterExpression(value) ?? initial());
  const hints = useId(), help = useId(), errorId = useId();
  // URL navigation can acknowledge a local apply after the person has already
  // started their next menu draft. That acknowledgement must not reset it.
  const applied = useRef(value);
  useEffect(() => {
    if (value === applied.current) return;
    applied.current = value;
    if (value) setOpen(true);
    setDraft(value); setError(''); setTree(parseFilterExpression(value) ?? initial());
  }, [value]);
  function apply(source: string) {
    try {
      const parsed = parseFilterExpression(source);
      applied.current = source.trim();
      setDraft(source.trim());
      onChange(source.trim());
      if (parsed) setTree(parsed);
      setError('');
    } catch (cause) { setError((cause as Error).message); }
  }
  return <details className="boolean-filters" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Advanced filter</summary>
    <p id={help}>Combine issue fields with AND, OR, NOT and parentheses. Suggestions use current visible records; dates use the workspace calendar. NOT applies first, then AND, then OR. Other filters still apply.</p>
    <form onSubmit={event => { event.preventDefault(); apply(draft); }}>
      <label>Filter expression
        <input value={draft} maxLength={expressionLimit} list={hints} aria-describedby={error ? `${help} ${errorId}` : help} aria-invalid={!!error} onChange={event => setDraft(event.target.value)} placeholder="(priority=high OR priority=urgent) AND NOT blocked"/>
      </label>
      <FilterExpressionSuggestions id={hints} draft={draft} options={options}/>
      <button type="submit">Apply expression</button>
      <button type="button" onClick={() => { applied.current = ''; setDraft(''); setTree(initial()); onChange(''); setError(''); }}>Clear expression</button>
    </form>
    <details><summary>Build expression</summary>
      <Condition options={options} value={tree} onChange={setTree}/>
      <output aria-label="Menu expression">{formatFilterExpression(tree)}</output>
      <button type="button" onClick={() => { const source = formatFilterExpression(tree); setDraft(source); apply(source); }}>Apply menu filter</button>
    </details>
    {error && <p id={errorId} role="alert">{error}</p>}
  </details>;
}
