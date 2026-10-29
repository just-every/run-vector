import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../../app/bindings';
import {readRequestJson} from '../../../app/input';
import {errorConnections,saveErrorConnection,appManager,managed} from './settings';
import {openSecret} from '../secrets';
import {IntegrationError} from '../errors';
import {requireIssueAccess} from '../../issues/access';
import {errorProviderRequest} from './provider';
import {auditStatement} from '../../audit/producer';
const linkInput=z.object({identifier:z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/),recordId:z.string().regex(/^[A-Za-z0-9._-]{1,100}$/)}).strict();
export function addErrorRoutes(app:Hono<AppEnvironment>){
 app.get('/settings/integrations/errors',async c=>c.json(await errorConnections(c.env,c.req.raw)));
 app.post('/settings/integrations/errors',async c=>c.json(await saveErrorConnection(c.env,c.req.raw,await readRequestJson(c.req.raw)),201));
 app.delete('/settings/integrations/errors/:id',async c=>{
  const owner=await appManager(c.env,c.req.raw),id=c.req.param('id')??'',at=new Date().toISOString();
  await managed(c.env,owner).batch([{sql:'UPDATE vector_integration_sources SET enabled=0,revoked_at=?,version=version+1,updated_at=? WHERE id=? AND workspace_id=?',params:[at,at,id,owner.workspace]},{sql:"DELETE FROM vector_integration_secret_keys WHERE identity=? AND EXISTS(SELECT 1 FROM vector_integration_sources WHERE id=? AND workspace_id=?)",params:['source-error:'+id,id,owner.workspace]},auditStatement({workspace:owner.workspace,actor:owner.id,action:'integration.error_revoked',subject:id,at})]);
  return c.json({revoked:true});
 });
 for(const action of ['link','resolve'] as const)app.post('/settings/integrations/errors/:id/'+action,async c=>{
  const owner=await appManager(c.env,c.req.raw),id=c.req.param('id')??'',parsed=linkInput.safeParse(await readRequestJson(c.req.raw));
  if(!parsed.success)throw new IntegrationError(400,'invalid_error_link');
  const input=parsed.data,access=await requireIssueAccess(c.env.DB,input.identifier,owner.id);
  const source=await c.env.DB.prepare('SELECT s.team_id,e.provider FROM vector_integration_sources s JOIN vector_error_connections e ON e.source_id=s.id WHERE s.id=? AND s.workspace_id=? AND s.enabled=1 AND s.revoked_at IS NULL').bind(id,owner.workspace).first<{team_id:string;provider:string}>();
  const issue=await c.env.DB.prepare('SELECT i.id,i.team_id,s.category FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.identifier=?').bind(input.identifier).first<{id:string;team_id:string;category:string}>();
  if(!access||!source||!issue||issue.team_id!==source.team_id)throw new IntegrationError(404,'error_link_unavailable');
  const at=new Date().toISOString();
  if(action==='link'){
   await managed(c.env,owner).batch([{sql:'INSERT INTO vector_source_records(source_id,record_id,issue_id,created_at) VALUES(?,?,?,?)',params:[id,input.recordId,issue.id,at]},auditStatement({workspace:owner.workspace,actor:owner.id,action:'integration.error_linked',subject:issue.id,at})]);
   return c.json({linked:true});
  }
  if(source.provider!=='sentry'||issue.category!=='completed'||!/^\d+$/.test(input.recordId))throw new IntegrationError(409,'error_resolution_requires_completed_issue');
  const [rows]=await managed(c.env,owner).batch([{sql:`SELECT k.encrypted FROM vector_source_records r JOIN vector_integration_secret_keys k ON k.identity='source-error:'||r.source_id AND k.slot='current' WHERE r.source_id=? AND r.record_id=? AND r.issue_id=? AND r.erased=0`,params:[id,input.recordId,issue.id]}]);
  if(!rows.length)throw new IntegrationError(409,'error_resolution_unavailable');
  const {token}=JSON.parse(await openSecret(c.env,'source-error:'+id,String(rows[0].encrypted))) as {token:string};
  const response=await errorProviderRequest('https://sentry.io/api/0/issues/'+input.recordId+'/','PUT',{Authorization:'Bearer '+token},{status:'resolved'});await response.body?.cancel();
  await managed(c.env,owner).batch([auditStatement({workspace:owner.workspace,actor:owner.id,action:'integration.sentry_resolved',subject:issue.id,at})]);
  return c.json({resolved:true});
 });
}
