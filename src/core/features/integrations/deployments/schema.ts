import {z} from 'zod';
import {gitSha} from '../github/push';
const identity=z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/);
/** A report is an authenticated assertion by the installation Owner, not a provider webhook. */
export const deploymentReportSchema=z.object({
 provider:z.literal('cloudflare-workers'),
 repositoryId:z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/),
 accountId:identity,
 workerId:identity,
 deploymentId:identity,
 sha:gitSha.refine(sha=>!/^0+$/.test(sha)),
 environment:z.string().trim().min(1).max(200),
 state:z.literal('success'),
 deployedAt:z.string().datetime({offset:true}),
}).strict();
export type DeploymentReport=z.infer<typeof deploymentReportSchema>;
