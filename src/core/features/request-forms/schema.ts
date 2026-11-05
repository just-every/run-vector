import { z } from 'zod'

const id = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/)
export const formFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().trim().min(1).max(120),
  help: z.string().max(1000).default(''),
  required: z.boolean().default(false),
  type: z.enum(['text', 'number', 'boolean', 'choice']).default('text'),
  choices: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
}).strict().refine(f => f.type !== 'choice' || (f.choices.length > 0 && new Set(f.choices).size === f.choices.length), 'Choose distinct options.')
export const formInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  fields: z.array(formFieldSchema).min(1).max(20).refine(fields => new Set(fields.map(f => f.key)).size === fields.length, 'Field keys must be distinct.'),
  published: z.boolean().default(true),
}).strict()
export const submissionSchema = z.object({
  id, revision: z.number().int().positive(),
  answers: z.record(z.string(), z.union([z.string().max(20000), z.number().finite(), z.boolean(), z.null()])).refine(v => Object.keys(v).length <= 20),
}).strict()
export const requestFormSchema = formInputSchema.extend({ id, teamId: id, revision: z.number().int().positive(), canEdit: z.boolean() })
export const formListSchema = z.object({ forms: z.array(requestFormSchema), canManage: z.boolean() })
export const submissionProjectionSchema = z.object({ id, revision: z.number().int().positive(), name: z.string(), fields: z.array(formFieldSchema), answers: submissionSchema.shape.answers })
export type FormInput = z.infer<typeof formInputSchema>
export type RequestForm = z.infer<typeof requestFormSchema>
export type FormSubmission = z.infer<typeof submissionSchema>
