import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { integrationOwner,guardedSql,ownerPredicate } from './authority';
import { ownerTokens } from './tokens';
import { recordDevMint } from './dev-credentials';
import { tokenInput,sourceConfigInput,rotationInput,destinationInput,githubInput } from './config-input';
import { registerSource,rotateSource,registerDestination,registerGithub,revokeConfiguration } from './config-storage';
import { reenterCredential } from './reenter';
import { deliveryConfigured } from './outbound';
import { configureDelivery, deliverySetupInput } from './delivery-setup';
import { sendTestWebhook } from './test-webhook';
import { NativeWebhookRepository } from './outbound-repository';
import { destinationSigningProblems } from './destination-signing';
import { IntegrationError } from './errors';
import { requireIssueProjection } from '../issues/projection-access';
const inputHelp:Record<string,string>={name:'Enter a name for this connection.',sourceId:'Use a source ID with letters, numbers, dots, underscores or hyphens.',teamId:'Choose a team for new reports.',repository:'Enter the GitHub owner and repository separated by /, for example just-every/run-vector.',overlapHours:'Choose a whole number of hours from 0 to 24.',accountId:'Enter the 32-character Cloudflare account ID.',apiToken:'Enter the Cloudflare read-only API token.',scopes:'Choose at least one API permission.',expiresAt:'Choose a valid future expiry date.'};
function parse<T>(schema:z.ZodType<T>,value:unknown){const result=schema.safeParse(value);if(!result.success)throw new IntegrationError(400,'invalid_integration_input',inputHelp[String(result.error.issues[0]?.path[0])]??'Check the form values and try again.');return result.data;}
const id=z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
export function addIntegrationConfigRoutes(app:Hono<AppEnvironment>){
 app.get('/settings/integrations',async c=>{
  const owner=await integrationOwner(c.env,c.req.raw),sql=guardedSql(c.env.DB,ownerPredicate(owner));
  const rows=await sql.batch([
   {sql:`SELECT id,source_id AS sourceId,name,team_id AS teamId,enabled,revoked_at AS revokedAt,NOT EXISTS(SELECT 1 FROM vector_integration_secret_keys k WHERE k.identity='source:'||vector_integration_sources.id AND k.slot='current') AS requiresReentry FROM vector_integration_sources WHERE workspace_id=? ORDER BY name,id LIMIT 100`,params:[owner.workspace]},
   {sql:`SELECT id,name,url,enabled,revoked_at AS revokedAt,(SELECT count(*) FROM vector_webhook_events e WHERE e.destination_id=vector_webhook_destinations.id AND e.enqueued_at IS NULL AND NOT EXISTS(SELECT 1 FROM vector_webhook_restore_holds h WHERE h.namespace=e.workspace_id AND h.id=e.id) AND NOT EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=e.workspace_id AND h.id=e.id)) AS waitingEvents FROM vector_webhook_destinations WHERE workspace_id=? ORDER BY name,id LIMIT 100`,params:[owner.workspace]},
   {sql:`SELECT id,name,repository,enabled,revoked_at AS revokedAt,NOT EXISTS(SELECT 1 FROM vector_integration_secret_keys k WHERE k.identity='github:'||vector_github_repositories.id AND k.slot='current') AS requiresReentry FROM vector_github_repositories WHERE workspace_id=? ORDER BY name,id LIMIT 100`,params:[owner.workspace]},
   {sql:'SELECT namespace,token_id AS id,name,scopes,created_at AS createdAt,expires_at AS expiresAt,revoked_at AS revokedAt,NOT EXISTS(SELECT 1 FROM integration_tokens t WHERE t.namespace=b.namespace AND t.id=b.token_id) AS requiresReentry FROM vector_integration_tokens b WHERE workspace_id=? AND operator_id=? ORDER BY created_at DESC LIMIT 100',params:[owner.workspace,owner.id]},
   {sql:'SELECT id,state,attempts,next_at AS nextAt,created_at AS createdAt,EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=integration_deliveries.namespace AND h.id=integration_deliveries.id) AS erased FROM integration_deliveries WHERE namespace=? ORDER BY created_at DESC,id LIMIT 100',params:[owner.workspace]},
   {sql:'SELECT e.id,e.event,e.created_at AS createdAt,e.enqueued_at AS enqueuedAt,EXISTS(SELECT 1 FROM vector_webhook_restore_holds h WHERE h.namespace=e.workspace_id AND h.id=e.id) AS held,EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=e.workspace_id AND h.id=e.id) AS erased FROM vector_webhook_events e WHERE e.workspace_id=? ORDER BY created_at DESC,id LIMIT 100',params:[owner.workspace]},
  ]);
  const problems=await destinationSigningProblems(c.env,owner.workspace),destinations=(rows[1] as {id:string}[]).map(row=>({...row,signingProblem:problems.get(row.id)??null,requiresReentry:problems.has(row.id)?1:0}));
  return c.json({sources:(rows[0] as {id:string}[]).map(row=>({...row,workspaceId:owner.workspace,receiver:c.env.APP_ORIGIN+'/api/integrations/sources/'+row.id+'/events'})),destinations,github:(rows[2] as {id:string}[]).map(row=>({...row,receiver:c.env.APP_ORIGIN+'/api/integrations/github/'+row.id})),tokens:rows[3],deliveries:rows[4],events:rows[5],outboundConfigured:await deliveryConfigured(c.env,owner.workspace),outboundSetupAvailable:true});
 });
 app.post('/settings/integrations/delivery',async c=>c.json(await configureDelivery(c.env,await integrationOwner(c.env,c.req.raw),parse(deliverySetupInput,await readRequestJson(c.req.raw)))));
 app.post('/settings/integrations/destinations/:id/test',async c=>c.json(await sendTestWebhook(c.env,await integrationOwner(c.env,c.req.raw),parse(id,c.req.param('id')))));
 app.post('/settings/integrations/tokens',async c=>{const owner=await integrationOwner(c.env,c.req.raw);const issued=await ownerTokens(c.env.DB,owner).issue(owner,parse(tokenInput,await readRequestJson(c.req.raw)));await recordDevMint(c.env.DB,owner.fence.sessionId,issued.credential.id);return c.json(issued,201);});
 app.get('/settings/integrations/tokens/usage',async c=>{const owner=await integrationOwner(c.env,c.req.raw);return c.json({usage:await ownerTokens(c.env.DB,owner).usage(owner)});});
 app.delete('/settings/integrations/tokens/:id',async c=>{const owner=await integrationOwner(c.env,c.req.raw),selected=c.req.param('id');if(!/^[a-f0-9-]{36}$/.test(selected))throw new IntegrationError(400,'invalid_token_id');return c.json(await ownerTokens(c.env.DB,owner).revoke(owner,selected));});
 app.post('/settings/integrations/sources',async c=>c.json(await registerSource(c.env,await integrationOwner(c.env,c.req.raw),parse(sourceConfigInput,await readRequestJson(c.req.raw))),201));
 app.post('/settings/integrations/sources/:id/rotate',async c=>{const input=parse(rotationInput,await readRequestJson(c.req.raw));return c.json(await rotateSource(c.env,await integrationOwner(c.env,c.req.raw),parse(id,c.req.param('id')),input.overlapHours));});
 app.post('/settings/integrations/destinations',async c=>c.json(await registerDestination(c.env,await integrationOwner(c.env,c.req.raw),parse(destinationInput,await readRequestJson(c.req.raw))),201));
 app.post('/settings/integrations/github',async c=>c.json(await registerGithub(c.env,await integrationOwner(c.env,c.req.raw),parse(githubInput,await readRequestJson(c.req.raw))),201));
 for(const [kind,path] of [['source','sources'],['destination','destinations'],['github','github']] as const)app.delete('/settings/integrations/'+path+'/:id',async c=>c.json(await revokeConfiguration(c.env,await integrationOwner(c.env,c.req.raw),kind,parse(id,c.req.param('id')))));
 for(const [kind,path] of [['destination','destinations'],['github','github']] as const)app.post('/settings/integrations/'+path+'/:id/reenter',async c=>c.json(await reenterCredential(c.env,await integrationOwner(c.env,c.req.raw),kind,parse(id,c.req.param('id'))),201));
 app.post('/settings/integrations/deliveries/:id/resolve',async c=>{
  const input=parse(z.object({kind:z.enum(['accepted','rejected']),evidenceCode:z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/)}).strict(),await readRequestJson(c.req.raw)),owner=await integrationOwner(c.env,c.req.raw),delivery=c.req.param('id');if(!/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/.test(delivery))throw new IntegrationError(400,'invalid_delivery_id');
  try{await new NativeWebhookRepository(guardedSql(c.env.DB,ownerPredicate(owner)),owner.workspace).resolve(delivery,{kind:input.kind,code:input.evidenceCode},Date.now());}catch{throw new IntegrationError(409,'delivery_not_uncertain');}return c.json({resolved:true,state:input.kind});
 });
 app.get('/issues/:identifier/github',async c=>{
  const issue=await requireIssueProjection(c,c.req.param('identifier'));
  const rows=(await c.env.DB.prepare(`SELECT r.repository,p.number,p.title,p.url,p.state,p.updated_at AS updatedAt FROM vector_github_issue_links l JOIN vector_github_repositories r ON r.id=l.repository_id JOIN vector_github_pull_requests p ON p.repository_id=l.repository_id AND p.number=l.number WHERE l.issue_id=? ORDER BY p.updated_at DESC,p.number LIMIT 100`).bind(issue.id).all()).results;
  await requireIssueProjection(c,issue.identifier);return c.json({pullRequests:rows});
 });
}
