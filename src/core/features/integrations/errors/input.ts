import {z} from 'zod';
import {IntegrationError} from '../errors';
import {sourceInputSchema} from '../source-input';
const scalar=z.union([z.string().max(20000),z.number(),z.boolean(),z.null()]);
const numeric=z.union([z.number().nonnegative(),z.string().regex(/^[0-9]+$/).transform(Number)]);
const sentryIssue=z.object({id:z.string().regex(/^[0-9]+$/),title:z.string().min(1).max(500),permalink:z.string().url(),count:numeric.optional(),userCount:numeric.optional(),lastSeen:z.string().datetime({offset:true}),status:z.string().optional(),substatus:z.string().optional(),metadata:z.object({value:z.string().max(20000).optional()}).optional(),release:z.union([z.string(),z.object({version:z.string()})]).optional()});
const sentry=z.object({action:z.enum(['created','resolved','unresolved','assigned','archived']),data:z.object({issue:sentryIssue})});
const datadog=z.object({id:z.union([z.string().min(1).max(100),z.number().int().nonnegative().transform(String)]),eventId:z.union([z.string().min(1).max(100),z.number().int().nonnegative().transform(String)]),transition:z.enum(['Triggered','Re-Triggered','Renotify','Recovered','case_created','case_reopened']),title:z.string().min(1).max(500),message:z.string().max(20000),link:z.string().url(),date:z.union([z.string(),z.number()]),frequency:scalar.optional(),affectedUsers:scalar.optional(),release:z.string().max(500).optional()});
export function normalizeError(provider:string,teamId:string,delivery:string,raw:unknown){
 if(provider==='sentry'){
  const parsed=sentry.safeParse(raw);if(!parsed.success)throw new IntegrationError(400,'invalid_sentry_event');
  const {action,data:{issue}}=parsed.data;
  const input=sourceInputSchema.safeParse({teamId,title:issue.title,description:issue.metadata?.value??'',summary:issue.title,sourceRecordId:issue.id,sourceRevisionId:delivery,observedAt:issue.lastSeen,link:issue.permalink,measurements:{frequency:issue.count??null,affectedUsers:issue.userCount??null,release:typeof issue.release==='string'?issue.release:issue.release?.version??null}});
  if(!input.success)throw new IntegrationError(400,'invalid_sentry_event');
  return {input:input.data,regression:action==='unresolved'&&issue.substatus==='regressed'};
 }
 const parsed=datadog.safeParse(raw);if(!parsed.success)throw new IntegrationError(400,'invalid_datadog_event');
 const event=parsed.data,seconds=Number(event.date),date=Number.isFinite(seconds)?new Date(seconds<1e12?seconds*1000:seconds):new Date(String(event.date));
 if(!Number.isFinite(date.getTime()))throw new IntegrationError(400,'invalid_datadog_event');
 const input=sourceInputSchema.safeParse({teamId,title:event.title,description:event.message,summary:event.message||event.title,sourceRecordId:event.id,sourceRevisionId:event.eventId,observedAt:date.toISOString(),link:event.link,measurements:{frequency:event.frequency??null,affectedUsers:event.affectedUsers??null,release:event.release??null}});
 if(!input.success)throw new IntegrationError(400,'invalid_datadog_event');
 return {input:input.data,regression:['Re-Triggered','Renotify','case_reopened'].includes(event.transition)};
}
