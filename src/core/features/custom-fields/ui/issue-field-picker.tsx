import type { CustomField } from '../schema';

/** The stored custom-field map, or null when it is not an object. */
export const fieldValues = (values: unknown) =>
  values !== null && typeof values === 'object' && !Array.isArray(values) ? values as Record<string, unknown> : null;

/** The whole map with one typed value set, or removed for no value. Other keys,
 * including legacy untyped ones, are sent back unchanged. */
export function withFieldValue(values: Record<string, unknown>, fieldId: string, optionId: string) {
  const next = { ...values };
  if (optionId) next[fieldId] = optionId;
  else delete next[fieldId];
  return next;
}

/** One applicable single-select field in the issue's property bar. */
export function IssueFieldPicker({ field, value, disabled, onChange }: {
  field: Pick<CustomField, 'id' | 'name' | 'options'>; value: unknown; disabled: boolean; onChange: (optionId: string) => void;
}) {
  const current = typeof value === 'string' ? value : '';
  return <label>
    <span className="issue-property-name">{field.name}</span>
    <select aria-label={`Issue ${field.name}`} value={current} disabled={disabled} onChange={event => onChange(event.target.value)}>
      <option value="">No {field.name.toLocaleLowerCase()}</option>
      {current && !field.options.some(option => option.id === current) ? <option value={current}>Unavailable option</option> : null}
      {field.options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
  </label>;
}
