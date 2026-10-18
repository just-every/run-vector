import { z } from 'zod';
import { importFields,importLimits } from './types';
const field=z.enum(importFields);
// Validate aliases as entries so every own key is checked and retained. Building
// the result with fromEntries treats prototype names as ordinary data properties.
const aliasRecord=<T extends z.ZodType>(target:T)=>z.custom<Record<PropertyKey,unknown>>(value=>
  typeof value==='object'&&value!==null&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null),
  {message:'Expected an object of source aliases.'})
  .transform(value=>Reflect.ownKeys(value).filter(key=>Object.prototype.propertyIsEnumerable.call(value,key)).map(key=>[key,value[key]]))
  .pipe(z.array(z.tuple([z.string().min(1).max(300),target])))
  .transform(entries=>Object.fromEntries(entries) as Record<string,z.output<T>>);
export const importInputSchema=z.object({
  format:z.enum(['csv','json','linear-csv','linear-api-json','jira-csv','plane-csv','huly-json','shortcut-csv']),name:z.string().min(1).max(160),
  jira:z.object({attachmentLinks:z.boolean().optional(),completedAtFallback:z.enum(['updated','created','effective']).optional(),originalEstimateSecondsPerUnit:z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),shortYearCentury:z.number().int().min(1000).max(9900).refine(value=>value%100===0).optional(),sourceOffset:z.string().regex(/^(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/).optional(),priorities:aliasRecord(z.enum(['none','low','medium','high','urgent'])).optional()}).strict().optional(),
  api:z.object({name:z.string().min(1).max(160),base64:z.string().max(Math.ceil(importLimits.bytes/3)*4)}).strict().optional(),
  base64:z.string().max(Math.ceil(importLimits.bytes/3)*4),source:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/),
  mapping:z.partialRecord(field,z.string().min(1).max(160)),
  defaults:z.partialRecord(field,z.string().max(100000)).optional(),
  references:z.partialRecord(field,aliasRecord(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/))).optional(),
  effectiveAt:z.string().max(40).optional(),
}).strict();
export const importApplySchema=z.object({
  input:importInputSchema,reviewedFingerprint:z.string().regex(/^[a-f0-9]{64}$/),
  operationKey:z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/),acknowledgeOmissions:z.boolean(),
}).strict();
