import { useId, useState } from 'react'
import { fetchJson, useApiResource } from '../../app/api-client'
import { formListSchema, requestFormSchema, type FormInput, type RequestForm } from './schema'
import './styles.css'

const initial = (): FormInput => ({ name: '', published: true, fields: [{ key: 'severity', label: 'Severity', type: 'choice', required: true, help: 'How severely does this bug affect your work?', choices: ['Low', 'Medium', 'High', 'Critical'] }] })
export function RequestFormSettings({ teamId }: { teamId: string }) {
  const url = '/api/teams/' + teamId + '/request-forms', list = useApiResource(url, formListSchema)
  const [draft, setDraft] = useState<FormInput | null>(null), [editing, setEditing] = useState<RequestForm | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), base = useId()
  const patch = (index: number, value: Partial<FormInput['fields'][number]>) => setDraft(current => current && ({ ...current, fields: current.fields.map((field, i) => i === index ? { ...field, ...value } : field) }))
  return <section className="team-block request-form-settings" aria-labelledby={base + '-heading'}>
    <h2 className="group-heading" id={base + '-heading'}>Request forms</h2>
    <p className="field-hint">Publish a team form for New intake. Answers stay with the submitted form revision.</p>
    {(error || list.error) && <p role="alert" className="confirm-error">{error || list.error?.message}</p>}
    {notice && <p role="status">{notice}</p>}
    {!list.data && !list.error && <p>Loading request forms…</p>}
    <ul className="request-form-rows">{list.data?.forms.map(form => <li key={form.id}><span>{form.name} · Revision {form.revision} · {form.published ? 'Published' : 'Withdrawn'}</span>{form.canEdit && <button type="button" className="button-text" onClick={() => { setDraft({ name: form.name, fields: form.fields, published: form.published }); setEditing(form); setNotice('') }}>Edit {form.name}</button>}</li>)}</ul>
    {list.data?.canManage && !draft && <button type="button" className="button-quiet" onClick={() => { setDraft(initial()); setEditing(null); setNotice('') }}>New request form</button>}
    {draft && <form aria-label="Edit request form" className="request-form-editor" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(''); setNotice('')
      try {
        const saved = await fetchJson(url + (editing ? '/' + editing.id : ''), requestFormSchema, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, ...(editing ? { expectedRevision: editing.revision } : {}) }) })
        setDraft(null); setEditing(null); setNotice('Saved ' + saved.name + ', revision ' + saved.revision + '.'); list.reload()
      } catch (e) { setError(e instanceof Error ? e.message : 'The form could not be saved.') } finally { setBusy(false) }
    }}><fieldset disabled={busy}><legend>{editing ? 'Edit form' : 'New form'}</legend>
      <label className="field">Form name<input required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
      <label className="request-form-check"><input type="checkbox" checked={draft.published} onChange={e => setDraft({ ...draft, published: e.target.checked })}/>Published for new submissions</label>
      {draft.fields.map((field, index) => <fieldset key={index} className="request-form-field"><legend>Field {index + 1}</legend>
        <label className="field">Field key {index + 1}<input required pattern="[a-z][a-z0-9_]{0,39}" maxLength={40} value={field.key} onChange={e => patch(index, { key: e.target.value })}/></label>
        <label className="field">Field label {index + 1}<input required maxLength={120} value={field.label} onChange={e => patch(index, { label: e.target.value })}/></label>
        <label className="field">Answer type {index + 1}<select value={field.type} onChange={e => patch(index, { type: e.target.value as typeof field.type })}><option value="text">Text</option><option value="choice">Choice</option><option value="number">Number</option><option value="boolean">Yes or no</option></select></label>
        {field.type === 'choice' && <label className="field">Choices {index + 1}<textarea required value={field.choices.join('\n')} onChange={e => patch(index, { choices: e.target.value.split('\n') })}/></label>}
        <label className="field">Help text {index + 1}<input maxLength={1000} value={field.help} onChange={e => patch(index, { help: e.target.value })}/></label>
        <label className="request-form-check"><input type="checkbox" checked={field.required} onChange={e => patch(index, { required: e.target.checked })}/>Required field {index + 1}</label>
        <button type="button" className="button-text" disabled={draft.fields.length === 1} onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })}>Remove field {index + 1}</button>
      </fieldset>)}
      <div className="confirm-actions"><button type="submit" className="button-ink">Save request form</button><button type="button" className="button-text" disabled={draft.fields.length >= 20} onClick={() => setDraft({ ...draft, fields: [...draft.fields, { key: 'field_' + (draft.fields.length + 1), label: '', type: 'text', required: false, help: '', choices: [] }] })}>Add form field</button><button type="button" className="button-text" onClick={() => { setDraft(null); setEditing(null) }}>Cancel form</button></div>
    </fieldset></form>}
  </section>
}
