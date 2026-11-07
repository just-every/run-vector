import { useId, useState, type FormEvent } from 'react';
import type { Administration } from '../../administration/schema';
import { useAdministrationCall } from '../../settings/ui/admin/administration';

/** "+ Add field": a short form in place with a name, an optional description,
 * the type and its options, and an explicit Add field. */
export function AddField({ team }: { team: Administration['teams'][number] }) {
  const id = useId();
  const call = useAdministrationCall();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '', '']);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function add(event: FormEvent) {
    event.preventDefault();
    setPending(true); setError('');
    try {
      await call(`/api/settings/teams/${team.id}/custom-fields`, 'POST', {
        name: name.trim(), description: description.trim(), type: 'single_select',
        options: options.map(option => option.trim()).filter(Boolean).map(option => ({ name: option })),
      });
      setName(''); setDescription(''); setOptions(['', '', '']); setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The field could not be added.'); }
    finally { setPending(false); }
  }
  if (!open) return <button type="button" className="link-button" onClick={() => setOpen(true)}><span aria-hidden="true">+</span> Add field</button>;
  return <form className="add-status add-field" aria-label={`Add field to ${team.name}`} onSubmit={add}>
    <div className="add-status-pair">
      <div className="field"><div className="field-head"><label htmlFor={`${id}-name`}>Name</label></div>
        <input id={`${id}-name`} type="text" required maxLength={120} value={name} autoComplete="off" autoFocus onChange={event => setName(event.target.value)} /></div>
      <div className="field"><div className="field-head"><label htmlFor={`${id}-type`}>Type</label></div>
        <select id={`${id}-type`} value="single_select" onChange={() => undefined}><option value="single_select">Single-select</option></select></div>
    </div>
    <div className="field"><div className="field-head"><label htmlFor={`${id}-description`}>Description (optional)</label></div>
      <input id={`${id}-description`} type="text" maxLength={2000} value={description} autoComplete="off" onChange={event => setDescription(event.target.value)} /></div>
    <fieldset className="field add-field-options"><legend className="field-head">Options</legend>
      {options.map((option, index) => <input key={index} type="text" aria-label={`Option ${index + 1}`} maxLength={120} value={option} autoComplete="off"
        onChange={event => setOptions(current => current.map((value, at) => at === index ? event.target.value : value))} />)}
      {options.length < 50 && <button type="button" className="link-button" onClick={() => setOptions(current => [...current, ''])}><span aria-hidden="true">+</span> Add option</button>}
    </fieldset>
    <div className="confirm-actions">
      <button type="submit" className="button-ink" disabled={pending}>Add field</button>
      <button type="button" className="button-text" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
    </div>
    {error && <p className="confirm-error" role="alert">{error}</p>}
  </form>;
}
