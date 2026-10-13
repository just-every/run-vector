import { z } from 'zod';
export const githubPayload=z.object({
 action:z.enum(['opened','edited','closed','reopened','synchronize']),number:z.number().int().positive(),
 repository:z.object({full_name:z.string().min(1).max(200)}),
 pull_request:z.object({number:z.number().int().positive(),title:z.string().max(500),body:z.string().max(100000).nullable(),html_url:z.string().max(2000),state:z.enum(['open','closed']),merged:z.boolean(),updated_at:z.string().datetime({offset:true})}),
});
export function githubReferences(title:string,body:string|null){
 return [...new Set((title+'\n'+(body??'')).match(/\b[A-Z]{2,10}-[1-9][0-9]*\b/g)??[])].sort();
}
