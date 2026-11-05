import {isMutationAccessError,AuthorityChangedError,VisibilityChangedError,RestoreReservationError} from '../../auth/mutation-database';
import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import {createUlid} from '../../../shared/ids';
import {IntegrationError} from '../errors';
import {gitGuard,gitMove,gitRule} from '../github/rules';
import {includedIssues,inclusionGuard} from './inclusion';
import type {DeploymentReport} from './schema';

type Receipt={id:string;payload_hash:string;linked:number};
/** The API database already fences the live bearer, sponsoring person and role
 * on every batch. Repository custody and restore holds are fenced here too. */
export async function recordDeployment(db:D1Database,actor:string,input:DeploymentReport){
 const repository=await db.prepare(`SELECT r.workspace_id FROM vector_github_repositories r
  JOIN operators o ON o.workspace_id=r.workspace_id AND o.id=? WHERE r.id=? AND r.enabled=1 AND r.revoked_at IS NULL`)
  .bind(actor,input.repositoryId).first<{workspace_id:string}>();
 if(!repository)throw new IntegrationError(404,'not_found');
 const authority=`EXISTS(SELECT 1 FROM vector_github_repositories r JOIN operators o ON o.workspace_id=r.workspace_id
  WHERE r.id=? AND r.workspace_id=? AND r.enabled=1 AND r.revoked_at IS NULL AND o.id=? AND o.role='owner' AND o.removed_at IS NULL)
  AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=0))`;
 const values=[input.repositoryId,repository.workspace_id,actor];
 const requireAuthority=async()=>{
  if(!await db.prepare('SELECT 1 WHERE '+authority).bind(...values).first())throw new IntegrationError(403,'deployment_authority_refused');
 };
 await requireAuthority();
 const hash=await sha256(JSON.stringify(input));
 const prior=()=>db.prepare(`SELECT d.id,d.payload_hash,(SELECT count(*) FROM vector_issue_deployments e WHERE e.report_id=d.id) linked
  FROM vector_deployment_reports d WHERE repository_id=? AND provider=? AND account_id=? AND worker_id=? AND deployment_id=?`)
  .bind(input.repositoryId,input.provider,input.accountId,input.workerId,input.deploymentId).first<Receipt>();
 const replay=async(row:Receipt)=>{
  await requireAuthority();
  if(row.payload_hash!==hash)throw new IntegrationError(409,'deployment_content_conflict');
  return {id:row.id,reused:true,linked:row.linked};
 };
 const retained=await prior();if(retained)return replay(retained);
 const issues=(await includedIssues(db,input,repository.workspace_id).all<{id:string;team_id:string;version:number}>()).results;
 if(issues.length>200)throw new IntegrationError(413,'deployment_issue_limit');
 const at=new Date().toISOString(),id=createUlid(new Date(at));
 const statements=[gitGuard(db,authority,...values),inclusionGuard(db,input,repository.workspace_id,issues),
  db.prepare(`INSERT INTO vector_deployment_reports(id,repository_id,provider,account_id,worker_id,deployment_id,sha,environment,deployed_at,payload_hash,reported_by,received_at)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,input.repositoryId,input.provider,input.accountId,input.workerId,input.deploymentId,input.sha,input.environment,new Date(input.deployedAt).toISOString(),hash,actor,at)];
 for(const issue of issues){
  statements.push(gitGuard(db,'EXISTS(SELECT 1 FROM issues WHERE id=? AND team_id=? AND version=?)',issue.id,issue.team_id,issue.version),
   db.prepare('INSERT INTO vector_issue_deployments(report_id,issue_id) VALUES(?,?)').bind(id,issue.id));
  const rule=await gitRule(db,issue.team_id,'deploy');
  statements.push(gitGuard(db,"COALESCE((SELECT version FROM github_automation_rules WHERE team_id=? AND trigger='deploy'),0)=?",issue.team_id,rule.version));
  if(input.environment.toLowerCase()===rule.environment.toLowerCase())statements.push(...await gitMove(db,issue.id,'deploy',at));
 }
 statements.push(gitGuard(db,authority,...values));
 try{await db.batch(statements);}catch(error){
  await requireAuthority();const committed=await prior();if(committed)return replay(committed);
  // Preserve native bearer, visibility and role fence errors for the API handler.
  if(isMutationAccessError(error)||error instanceof AuthorityChangedError||error instanceof VisibilityChangedError||error instanceof RestoreReservationError)throw error;
  throw new IntegrationError(503,'deployment_durability_unavailable');
 }
 await requireAuthority();return {id,reused:false,linked:issues.length};
}
