import {z} from 'zod';
import {fetchJson} from '../../../app/api-client';
const configured=z.object({id:z.string(),name:z.string(),enabled:z.number(),revokedAt:z.string().nullable(),requiresReentry:z.number()});
export const configSchema=z.object({sources:z.array(configured.extend({sourceId:z.string(),teamId:z.string()})),destinations:z.array(configured.extend({url:z.string(),signingProblem:z.enum(['secret_missing','secret_unreadable']).nullable(),waitingEvents:z.number()})),github:z.array(configured.extend({repository:z.string()})),tokens:z.array(z.object({id:z.string(),name:z.string(),scopes:z.string(),createdAt:z.number(),expiresAt:z.number().nullable(),revokedAt:z.number().nullable(),requiresReentry:z.number()})),deliveries:z.array(z.object({id:z.string(),state:z.string(),erased:z.number(),attempts:z.number(),nextAt:z.number(),createdAt:z.number()})),events:z.array(z.object({id:z.string(),event:z.string(),createdAt:z.string(),enqueuedAt:z.string().nullable(),held:z.number(),erased:z.number()})),outboundConfigured:z.boolean()});
export type Configuration=z.infer<typeof configSchema>;
export const secretSchema=z.object({id:z.string().optional(),token:z.string().optional(),secret:z.string().optional(),receiver:z.string().optional(),workspaceId:z.string().optional(),sourceId:z.string().optional()});
export type Secret=z.infer<typeof secretSchema>;
export const send=<S extends z.ZodType>(path:string,schema:S,body:unknown,method='POST')=>fetchJson('/api/settings/integrations'+path,schema,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
export const acknowledged=z.object({}).passthrough();
