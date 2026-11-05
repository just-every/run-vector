import {z} from 'zod';
export const bitbucketUuid=z.string().regex(/^\{[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}$/i).transform(value=>value.toLowerCase());
export const bitbucketConfiguration=z.object({name:z.string().trim().min(1).max(120),repository:z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/).max(200).transform(value=>value.toLowerCase()),repositoryUuid:bitbucketUuid}).strict();
const repository=z.object({uuid:bitbucketUuid,full_name:z.string().min(3).max(200)});
export const bitbucketPayload=z.object({
 actor:z.object({uuid:bitbucketUuid}),repository,
 pullrequest:z.object({id:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),title:z.string().min(1).max(500),description:z.string().max(100000).nullable(),state:z.enum(['OPEN','MERGED']),updated_on:z.string().datetime({offset:true}),links:z.object({html:z.object({href:z.string().max(2000)})}),destination:z.object({repository})}),
});
/** Native identifiers in PR title and description; other provider objects remain held. */
export function bitbucketReferences(title:string,description:string|null){
 return [...new Set(((title+'\n'+(description??'')).match(/\b[A-Z][A-Z0-9_]{1,99}-[1-9][0-9]*\b/gi)??[]).map(value=>value.toUpperCase()))].sort();
}
