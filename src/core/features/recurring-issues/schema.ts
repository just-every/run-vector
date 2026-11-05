import { z } from 'zod'
import { defaultsSchema } from '../issue-templates/schema'

export const seriesInputSchema=z.object({
  name:z.string().trim().min(1).max(120),
  teamId:z.string().length(26),
  templateId:z.string().length(26),
  templateVersion:z.number().int().positive(),
  cadence:z.literal('weekly'),
  startsOn:z.string().date(),
  dueOffsetDays:z.number().int().min(0).max(365).nullable().default(null),
  skipWhileOpen:z.boolean().default(false),
  overrides:defaultsSchema.default({}),
}).strict()
export const stopInputSchema=z.object({
  expectedVersion:z.number().int().positive(),
  state:z.enum(['paused','ended']),
}).strict()
export type SeriesInput=z.infer<typeof seriesInputSchema>
const issueReference=z.object({id:z.string(),identifier:z.string(),title:z.string()})
export const occurrenceSchema=z.object({
  dueOn:z.string(),scheduledAt:z.string(),outcome:z.enum(['created','skipped','failed']),
  issue:issueReference.nullable(),children:z.array(issueReference),error:z.string().nullable(),at:z.string(),
})
export const seriesSchema=z.object({
  id:z.string(),name:z.string(),teamId:z.string(),configuringPersonId:z.string(),
  templateId:z.string(),templateVersion:z.number().int(),cadence:z.literal('weekly'),
  timezone:z.string(),startsOn:z.string(),nextOn:z.string(),dueOffsetDays:z.number().int().nullable(),
  skipWhileOpen:z.boolean(),overrides:defaultsSchema,state:z.enum(['enabled','paused','ended']),
  version:z.number().int(),lastError:z.string().nullable(),restoreHeld:z.boolean(),history:z.array(occurrenceSchema),
})
export const seriesListSchema=z.object({series:z.array(seriesSchema)})
export type Series=z.infer<typeof seriesSchema>
export type Occurrence=z.infer<typeof occurrenceSchema>
export type SeriesRow={
  id:string;workspace_id:string;configuring_operator_id:string;team_id:string;
  template_id:string;template_version:number;name:string;timezone:string;
  starts_on:string;next_on:string;due_offset_days:number|null;skip_while_open:number;
  overrides_json:string;state:'enabled'|'paused'|'ended';version:number;
  last_issue_id:string|null;last_error:string|null;created_at:string;updated_at:string;
}
