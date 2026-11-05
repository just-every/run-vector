import type { z } from 'zod'
import type { submissionProjectionSchema } from './schema'
import './styles.css'
export function RequestFormAnswers({ submission }: { submission: z.infer<typeof submissionProjectionSchema> | null | undefined }) {
  if (!submission) return null
  return <section className="request-form-saved" aria-label="Submitted request form"><h2>{submission.name}</h2><p>Submitted form revision {submission.revision}</p><dl>{submission.fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{typeof submission.answers[field.key] === 'boolean' ? submission.answers[field.key] ? 'Yes' : 'No' : String(submission.answers[field.key] ?? 'Not answered')}</dd></div>)}</dl></section>
}
