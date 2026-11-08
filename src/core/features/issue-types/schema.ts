import { z } from 'zod'
import { projectIcon } from '../projects/appearance'
const id = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)
export const typeEnableSchema = z.object({ enabled: z.boolean() }).strict()
export const typeUpdateSchema = z.object({
 expectedVersion: z.number().int().positive(),
 name: z.string().trim().min(1).max(120).optional(),
 icon: projectIcon.optional(),
 requiredFieldIds: z.array(id).max(50).refine(ids => new Set(ids).size === ids.length).optional(),
}).strict().refine(value => Object.keys(value).length > 1)
export const issueTypeSchema = z.object({
 id: z.string(), teamId: z.string(), name: z.string(), icon: z.string(),
 defaultKey: z.enum(['bug','feature','task','epic']), version: z.number(), requiredFieldIds: z.array(z.string()),
})
export type IssueType = z.output<typeof issueTypeSchema>
export type TypeUpdate = z.output<typeof typeUpdateSchema>
