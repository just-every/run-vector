import {z} from 'zod';
import {IntegrationError} from '../errors';
import {gitSha,pushPayload} from './push';
import {githubDelivery,type GithubDelivery} from './delivery';
import {gitMove,gitRule,gitGuard} from './rules';
import {productionStatement} from '../../deployment-followup/watches';
const payload=z.object({
 repository:z.object({full_name:z.string().min(1).max(200)}),
 deployment:z.object({id:z.number().int().positive(),sha:gitSha,environment:z.string().min(1).max(200)}),
 deployment_status:z.object({state:z.enum(['success','failure','error','inactive','in_progress','pending','queued','waiting']),created_at:z.string().datetime({offset:true})}),
});
/** GitHub's signed, non-forced branch update proves both its old head and
 * the supplied commits are ancestors of its new head. A missing flag, forced
 * update, deletion or zero head proves nothing. Never call compare APIs. */
export async function recordPushProof(context:GithubDelivery,input:z.infer<typeof pushPayload>,at:string){
 if(input.forced!==false||input.deleted||!input.before||!input.after||/^0+$/.test(input.after))return [];
 const ancestors=[...new Set([input.before,...input.commits.map(c=>c.id)])].filter(sha=>!/^0+$/.test(sha)&&sha!==input.after);
 return [context.db.prepare('INSERT INTO github_push_proofs(repository_id,delivery_id,after_sha,ancestors_json,received_at) VALUES(?,?,?,?,?)').bind(context.id,context.delivery,input.after,JSON.stringify(ancestors),at)];
}
export async function receiveDeployment(raw:unknown,context:GithubDelivery){
 const parsed=payload.safeParse(raw);if(!parsed.success)throw new IntegrationError(400,'invalid_github_deployment');
 const input=parsed.data,{db,id,workspace,repository}=context,deployment=input.deployment;
 if(input.repository.full_name.toLowerCase()!==repository)throw new IntegrationError(400,'github_repository_mismatch');
 return githubDelivery(context,async()=>{
  if(input.deployment_status.state!=='success')return {statements:[],linked:0,diagnostic:'deployment_not_successful'};
  const previous=await db.prepare('SELECT sha,environment,deployed_at FROM github_deployments WHERE repository_id=? AND deployment_id=?').bind(id,deployment.id).first<{sha:string;environment:string;deployed_at:string}>();
  if(previous&&(previous.sha!==deployment.sha||previous.environment!==deployment.environment))throw new IntegrationError(409,'github_deployment_conflict');
  const at=previous?.deployed_at??new Date(input.deployment_status.created_at).toISOString();
  const issues=(await db.prepare(`WITH RECURSIVE included(sha) AS (
   SELECT ? UNION SELECT j.value FROM github_push_proofs p JOIN included head ON p.after_sha=head.sha JOIN json_each(p.ancestors_json) j WHERE p.repository_id=?
  ), linked(issue_id) AS (
   SELECT issue_id FROM github_commit_links WHERE repository_id=? AND sha IN (SELECT sha FROM included)
   UNION SELECT l.issue_id FROM vector_github_issue_links l JOIN vector_github_pull_requests p ON p.repository_id=l.repository_id AND p.number=l.number WHERE l.repository_id=? AND p.state='merged' AND p.merge_sha IN (SELECT sha FROM included)
  )
  SELECT i.id,i.team_id,i.version FROM linked JOIN issues i ON i.id=linked.issue_id JOIN teams t ON t.id=i.team_id
  WHERE t.workspace_id=? AND NOT EXISTS(SELECT 1 FROM github_issue_environments e WHERE e.repository_id=? AND e.deployment_id=? AND e.issue_id=i.id) LIMIT 201`)
   .bind(deployment.sha,id,id,id,workspace,id,deployment.id).all<{id:string;team_id:string;version:number}>()).results;
  if(issues.length>200)throw new IntegrationError(413,'github_deployment_issue_limit');
  const statements=[db.prepare('INSERT INTO github_deployments(repository_id,deployment_id,sha,environment,deployed_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING').bind(id,deployment.id,deployment.sha,deployment.environment,at)];
  for(const issue of issues){
   statements.push(gitGuard(db,'EXISTS(SELECT 1 FROM issues WHERE id=? AND team_id=? AND version=?) AND NOT EXISTS(SELECT 1 FROM github_issue_environments WHERE repository_id=? AND deployment_id=? AND issue_id=?)',issue.id,issue.team_id,issue.version,id,deployment.id,issue.id),
    db.prepare('INSERT INTO github_issue_environments(repository_id,deployment_id,issue_id) VALUES(?,?,?)').bind(id,deployment.id,issue.id));
   const rule=await gitRule(db,issue.team_id,'deploy');
   statements.push(gitGuard(db,'COALESCE((SELECT version FROM github_automation_rules WHERE team_id=? AND trigger=\'deploy\'),0)=?',issue.team_id,rule.version));
   if(deployment.environment.toLowerCase()===rule.environment.toLowerCase())statements.push(...await gitMove(db,issue.id,'deploy',new Date().toISOString()));
  }
  statements.push(productionStatement(db,id,deployment,at));
  return {statements,linked:issues.length,diagnostic:issues.length?'deployment_linked':'deployment_inclusion_unproven_or_recorded'};
 });
}
