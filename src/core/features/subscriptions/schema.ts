import {z} from 'zod';
export const subjectTypes=['team','project','label','view','initiative'] as const;
export const subscriptionInput=z.object({subjectType:z.enum(subjectTypes),subjectId:z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)}).strict();
export const subjectSchema=z.object({subjectType:z.enum(subjectTypes),subjectId:z.string(),name:z.string(),url:z.string()});
export const subscriptionSchema=subjectSchema.extend({id:z.string(),available:z.boolean()});
export const subscriptionList=z.object({canManage:z.boolean(),subscriptions:z.array(subscriptionSchema),subjects:z.array(subjectSchema)});
export type SubjectType=typeof subjectTypes[number];
export type Subscription={id:string;subjectType:SubjectType;subjectId:string;startRevision:number};
