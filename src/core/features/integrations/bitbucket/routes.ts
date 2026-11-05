import type {Hono} from 'hono';
import type {AppEnvironment} from '../../../app/bindings';
import {readRequestJson} from '../../../app/input';
import {integrationOwner,guardedSql,ownerPredicate} from '../authority';
import {IntegrationError} from '../errors';
import {revokeConfiguration} from '../config-storage';
import {reenterCredential} from '../reenter';
import {IssueAccessError} from '../../issues/access';
import {requireIssueProjection} from '../../issues/projection-access';
import {bitbucketConfiguration} from './input';
import {registerBitbucket} from './settings';
export async function bitbucketIssueProjection(db:D1Database,issue:string){
 return (await db.prepare(`SELECT r.repository,p.number,p.title,p.url,p.state,p.updated_at AS updatedAt FROM vector_bitbucket_issue_links l JOIN vector_bitbucket_repositories r ON r.id=l.repository_id JOIN vector_bitbucket_pull_requests p ON p.repository_id=l.repository_id AND p.number=l.number WHERE l.issue_id=? ORDER BY p.updated_at DESC,r.id,p.number LIMIT 100`).bind(issue).all()).results;
}
export function addBitbucketRoutes(app:Hono<AppEnvironment>){
 app.get('/settings/integrations/bitbucket',async c=>{
  const owner=await integrationOwner(c.env,c.req.raw,c.get('documentProjection')?c.get('operator'):undefined);
  const [repositories]=await guardedSql(c.env.DB,ownerPredicate(owner)).batch([{sql:`SELECT id,name,repository,repository_uuid AS repositoryUuid,revoked_at AS revokedAt,NOT EXISTS(SELECT 1 FROM vector_integration_secret_keys k WHERE k.identity='bitbucket:'||r.id AND k.slot='current') AS requiresReentry FROM vector_bitbucket_repositories r WHERE workspace_id=? ORDER BY name,id LIMIT 100`,params:[owner.workspace]}]);
  return c.json({repositories:repositories.map(row=>({...row,receiver:c.env.APP_ORIGIN+'/api/integrations/bitbucket/'+row.id}))});
 });
 app.post('/settings/integrations/bitbucket',async c=>{
  const parsed=bitbucketConfiguration.safeParse(await readRequestJson(c.req.raw));
  if(!parsed.success)throw new IntegrationError(400,'invalid_bitbucket_configuration','Enter the repository name, workspace and slug, and its braced repository UUID.');
  return c.json(await registerBitbucket(c.env,await integrationOwner(c.env,c.req.raw),parsed.data),201);
 });
 app.delete('/settings/integrations/bitbucket/:id',async c=>c.json(await revokeConfiguration(c.env,await integrationOwner(c.env,c.req.raw),'bitbucket',c.req.param('id'))));
 app.post('/settings/integrations/bitbucket/:id/reenter',async c=>c.json(await reenterCredential(c.env,await integrationOwner(c.env,c.req.raw),'bitbucket',c.req.param('id')),201));
 app.get('/issues/:identifier/bitbucket',async c=>{
  try{const issue=await requireIssueProjection(c,c.req.param('identifier'));
  const pullRequests=await bitbucketIssueProjection(c.env.DB,issue.id);
  await requireIssueProjection(c,c.req.param('identifier'));
  return c.json({pullRequests},200,{'Cache-Control':'no-store'});
  }catch(error){if(error instanceof IssueAccessError)return c.json({error:error.code,message:error.message},error.status,{'Cache-Control':'no-store'});throw error;}
 });
}
