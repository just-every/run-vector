import { z } from 'zod'

const id = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)
const name = z.string().trim().min(1).max(120)
const description = z.string().trim().max(2000)
/** FIELD-001 ships team single-select fields first; the other types stay targets. */
export const fieldTypes = ['single_select'] as const
const distinct = (options: { name: string }[]) =>
  new Set(options.map(option => option.name.toLocaleLowerCase())).size === options.length
const options = <T extends z.ZodType<{ name: string }>>(option: T) =>
  z.array(option).min(1).max(50).refine(distinct, 'Option names must be unique.')

export const fieldCreateSchema = z.object({
  name,
  description: description.default(''),
  type: z.enum(fieldTypes),
  options: options(z.object({ name }).strict()),
}).strict()

/** Existing options are named by id, in their current order; new options have no id and go last. */
export const fieldUpdateSchema = z.object({
  expectedVersion: z.number().int().positive(),
  name: name.optional(),
  description: description.optional(),
  options: options(z.object({ id: id.optional(), name }).strict()).optional(),
}).strict().refine(value => Object.keys(value).length > 1, 'At least one change is required.')

export const fieldOptionSchema = z.object({ id: z.string(), name: z.string() })
/** One team field as Settings, /api/v1/metadata and the issue detail pane read it. */
export const customFieldSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(fieldTypes),
  version: z.number(),
  options: z.array(fieldOptionSchema),
})

export type FieldCreateInput = z.output<typeof fieldCreateSchema>
export type FieldUpdateInput = z.output<typeof fieldUpdateSchema>
export type CustomField = z.output<typeof customFieldSchema>
