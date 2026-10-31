import { isIssueOperand, IssueOperandInput } from './filter-issue-suggestions';
import type { WorkspaceOptions } from '../../../shared/workspace-options';
import { operandChoices } from './filter-suggestions';
import { dateFields, operandLabels, operatorsFor, type FilterTerm, type Operand, type Operator } from '../filter-operands';
function initialValue(field: Operand, options: WorkspaceOptions | null) {
  return operandChoices(field, options)?.[0]?.id ?? (dateFields.includes(field) ? 'today' : field === 'estimate' ? '1' : (isIssueOperand(field) || field === 'release') ? 'none' : '');
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
      {operatorsFor(value.field).map(operator => <option key={operator} value={operator}>{({ '=': 'Is', '!=': 'Is not', '~': 'Contains', '<': dateFields.includes(value.field) ? 'Before' : 'Less than', '<=': dateFields.includes(value.field) ? 'On or before' : 'At most', '>': dateFields.includes(value.field) ? 'After' : 'Greater than', '>=': dateFields.includes(value.field) ? 'On or after' : 'At least', within: 'Within calendar days' })[operator]}</option>)}
    </select></label>
    <label>Value{choices ? <select aria-label={`Value ${path}`} value={value.value} onChange={event => onChange({ ...value, value: event.target.value })}>
      {choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
      {!choices.some(choice => choice.id === value.value) && <option value={value.value}>Selected value unavailable</option>}
    </select> : isIssueOperand(value.field) ? <IssueOperandInput value={value.value} path={path} onChange={next => onChange({ ...value, value: next })}/> : <input aria-label={`Value ${path}`} maxLength={200} value={value.value} onChange={event => onChange({ ...value, value: event.target.value, ...(['title', 'identifier', 'description', 'outcome', 'impact'].includes(value.field) ? { literal: true as const } : {}) })} placeholder={value.operator === 'within' ? 'last 7 days' : dateFields.includes(value.field) ? '2027-01-15 or next Friday' : ['parent', 'related', 'blocks', 'blockedby'].includes(value.field) ? 'ENG-123 or none' : value.field === 'release' ? 'Release ID or none' : undefined}/>}</label>
  </>;
}
