import { useId } from 'react'
import { useApiResource } from '../../app/api-client'
import { formListSchema, type FormSubmission, type RequestForm } from './schema'
import './styles.css'
export function RequestFormChoice({ teamId, selected, answers, choose, answer }: { teamId: string; selected: RequestForm | null; answers: FormSubmission['answers']; choose: (form: RequestForm | null) => void; answer: (key: string, value: string | number | boolean | null) => void }) {
  const list = useApiResource('/api/teams/' + teamId + '/request-forms', formListSchema), base = useId()
  return <section className="new-issue-section request-form-choice" aria-label="Request form answers">
    {list.error && <p role="alert">{list.error.message}</p>}
    <label>Request form<select aria-label="Request form" value={selected?.id ?? ''} onChange={e => choose(list.data?.forms.find(f => f.id === e.target.value) ?? null)}><option value="">Ordinary intake</option>{list.data?.forms.filter(f => f.published).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    {selected && <><p>Form revision {selected.revision}</p>{selected.fields.map(field => {
      const id = base + '-' + field.key, help = id + '-help', value = answers[field.key]
      return <div className="field" key={field.key}><label htmlFor={id}>{field.label}{field.required ? ' (required)' : ''}</label>
        {field.type === 'choice' || field.type === 'boolean' ? <select id={id} required={field.required} aria-describedby={field.help ? help : undefined} value={value === undefined || value === null ? '' : String(value)} onChange={e => answer(field.key, e.target.value === '' ? null : field.type === 'boolean' ? e.target.value === 'true' : e.target.value)}><option value="">Choose an answer</option>{(field.type === 'boolean' ? ['true', 'false'] : field.choices).map(choice => <option value={choice} key={choice}>{field.type === 'boolean' ? choice === 'true' ? 'Yes' : 'No' : choice}</option>)}</select> : <input id={id} type={field.type === 'number' ? 'number' : 'text'} step={field.type === 'number' ? 'any' : undefined} maxLength={20000} required={field.required} aria-describedby={field.help ? help : undefined} value={typeof value === 'string' || typeof value === 'number' ? value : ''} onChange={e => answer(field.key, field.type === 'number' ? e.target.value === '' ? null : Number(e.target.value) : e.target.value)}/>}
        {field.help && <p className="field-hint" id={help}>{field.help}</p>}
      </div>
    })}</>}
  </section>
}
