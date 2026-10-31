import type { WorkspaceOptions } from '../../../shared/workspace-options';
import { categories, dateFields, operandLabels, type Operand } from '../filter-operands';
type Choice = { id: string; name: string };
export function operandChoices(field: Operand, options: WorkspaceOptions | null): Choice[] | null {
  const none = { id: 'none', name: 'None' };
  switch (field) {
    case 'category': return categories.map(id => ({ id, name: id[0].toUpperCase() + id.slice(1) }));
    case 'status': return options?.statuses ?? [];
    case 'team': return options?.teams ?? [];
    case 'git': return ['none', 'open', 'closed', 'merged'].map(id => ({ id, name: id === 'none' ? 'No linked pull request' : id[0].toUpperCase() + id.slice(1) }));
    case 'creator':
    case 'follower':
    case 'assignee': return [{ id: 'me', name: 'Me' }, none, ...(options?.operators ?? [])];
    case 'release': return [none, ...(options?.releases ?? [])];
    case 'project': return [none, ...(options?.projects ?? [])];
    case 'cycle': return [none, ...(options?.cycles ?? [])];
    case 'label': return [none, ...(options?.labels ?? [])];
    case 'milestone': return [none, ...(options?.milestones ?? [])];
    default: return null;
  }
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
