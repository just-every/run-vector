import { z } from 'zod';
import { operatorIntakeInputSchema } from '../operator-intake/input';
export const sourceInputSchema=operatorIntakeInputSchema.extend({
 sourceRecordId:z.string().min(1).max(128),sourceRevisionId:z.string().min(1).max(128),observedAt:z.string().datetime({offset:true}),
 assertions:z.record(z.string().min(1).max(100),z.object({value:z.union([z.string().max(20000),z.number(),z.boolean(),z.null()]),attribution:z.literal('source')}).strict()).refine(value=>Object.keys(value).length<=50).default({}),
}).strict();
export type SourceInput=z.infer<typeof sourceInputSchema>;
export function canonicalSource(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonicalSource).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalSource((value as Record<string,unknown>)[key])).join(',')+'}';
 return JSON.stringify(value);
}
