import type { WorkspaceOptions } from '../../../shared/workspace-options';
import { categories, dateFields, operandLabels, operatorsFor, type FilterTerm, type Operand, type Operator } from '../filter-operands';
type Choice = { id: string; name: string };
export function operandChoices(field: Operand, options: WorkspaceOptions | null): Choice[] | null {
  const none = { id: 'none', name: 'None' };
  switch (field) {
    case 'category': return categories.map(id => ({ id, name: id[0].toUpperCase() + id.slice(1) }));
    case 'status': return options?.statuses ?? [];
    case 'team': return options?.teams ?? [];
    case 'assignee': return [{ id: 'me', name: 'Me' }, none, ...(options?.operators ?? [])];
    case 'project': return [none, ...(options?.projects ?? [])];
    case 'cycle': return [none, ...(options?.cycles ?? [])];
    case 'label': return [none, ...(options?.labels ?? [])];
    case 'milestone': return [none, ...(options?.milestones ?? [])];
    default: return null;
  }
}
function initialValue(field: Operand, options: WorkspaceOptions | null) {
  return operandChoices(field, options)?.[0]?.id ?? (dateFields.includes(field) ? 'today' : field === 'estimate' ? '1' : field === 'parent' ? 'none' : '');
}
export function TermControls({ value, onChange, path, options }: {
  value: FilterTerm; onChange: (term: FilterTerm) => void; path: string; options: WorkspaceOptions | null;
}) {
  const choices = operandChoices(value.field, options);
  return <>
    <label>Field<select aria-label={`Field ${path}`} value={value.field} onChange={event => {
      const field = event.target.value as Operand;
      onChange({ kind: 'term', field, operator: '=', value: initialValue(field, options) });
    }}>{Object.entries(operandLabels).map(([field, label]) => <option key={field} value={field}>{label}</option>)}</select></label>
    <label>Operator<select aria-label={`Operator ${path}`} value={value.operator} onChange={event => onChange({ ...value, operator: event.target.value as Operator })}>
      {operatorsFor(value.field).map(operator => <option key={operator} value={operator}>{({ '=': 'Is', '!=': 'Is not', '~': 'Contains', '<': 'Before or less than', '<=': 'On or before; at most', '>': 'After or greater than', '>=': 'On or after; at least', within: 'Within calendar days' })[operator]}</option>)}
    </select></label>
    <label>Value{choices ? <select aria-label={`Value ${path}`} value={value.value} onChange={event => onChange({ ...value, value: event.target.value })}>
      {choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
      {!choices.some(choice => choice.id === value.value) && <option value={value.value}>Selected value unavailable</option>}
    </select> : <input aria-label={`Value ${path}`} maxLength={200} value={value.value} onChange={event => onChange({ ...value, value: event.target.value })} placeholder={value.operator === 'within' ? 'last 7 days' : dateFields.includes(value.field) ? '2027-01-15 or next Friday' : value.field === 'parent' ? 'ENG-123 or none' : undefined}/>}</label>
  </>;
}
/** Suggestions complete the current operand without discarding earlier groups. */
export function expressionSuggestions(draft: string, options: WorkspaceOptions | null) {
  const match = draft.match(/^(.*\b(?:AND|OR|NOT)\s+|.*\()([^()]*)$/i);
  const prefix = match?.[1] ?? '', fragment = (match?.[2] ?? draft).toLowerCase();
  const terms: { value: string; label: string }[] = ['urgent', 'high', 'medium', 'low', 'none'].map(value => ({ value: 'priority=' + value, label: 'Priority: ' + value }));
  terms.push({ value: 'blocked', label: 'Blocked' }, { value: 'NOT blocked', label: 'Not blocked' });
  for (const [field, label] of Object.entries(operandLabels)) {
    const choices = operandChoices(field as Operand, options);
    for (const choice of choices ?? []) terms.push({ value: `${field}=${choice.id}`, label: `${label}: ${choice.name}` });
    if (dateFields.includes(field)) for (const value of ['today', 'tomorrow', 'yesterday', 'next Friday']) terms.push({ value: `${field} before ${value}`, label: `${label}: before ${value}` });
    if (dateFields.includes(field)) terms.push({ value: `${field} in the last 7 days`, label: `${label}: last 7 calendar days including today` });
    if (!choices && !dateFields.includes(field)) terms.push({ value: `${field}${['title', 'description', 'outcome', 'impact'].includes(field) ? '~""' : '='}`, label });
  }
  return terms.filter(term => term.value.toLowerCase().startsWith(fragment) || term.label.toLowerCase().startsWith(fragment)).slice(0, 80).map(term => ({ ...term, value: prefix + term.value }));
}
