import { z } from 'zod';
import { importFields,importLimits } from './types';
const field=z.enum(importFields);
export const importInputSchema=z.object({
  format:z.enum(['csv','json','linear-csv','linear-api-json','jira-csv']),name:z.string().min(1).max(160),
  jira:z.object({shortYearCentury:z.number().int().min(1000).max(9900).refine(value=>value%100===0).optional(),sourceOffset:z.string().regex(/^(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/).optional(),priorities:z.record(z.string().min(1).max(300),z.enum(['none','low','medium','high','urgent'])).optional()}).strict().optional(),
  api:z.object({name:z.string().min(1).max(160),base64:z.string().max(Math.ceil(importLimits.bytes/3)*4)}).strict().optional(),
  base64:z.string().max(Math.ceil(importLimits.bytes/3)*4),source:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/),
  mapping:z.partialRecord(field,z.string().min(1).max(160)),
  defaults:z.partialRecord(field,z.string().max(100000)).optional(),
  references:z.partialRecord(field,z.record(z.string().min(1).max(300),z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/))).optional(),
  effectiveAt:z.string().max(40).optional(),
}).strict();
export const importApplySchema=z.object({
  input:importInputSchema,reviewedFingerprint:z.string().regex(/^[a-f0-9]{64}$/),
  operationKey:z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/),acknowledgeOmissions:z.boolean(),
}).strict();
