import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../../app/bindings';
import {readRequestJson} from '../../../app/input';
import {audit} from '../../administration/transaction';
import {loadAuthority} from '../../roles/authority';
import {decide} from '../../roles/policy';
import {IntegrationError} from '../errors';
import {gitRule,gitTriggers,gitGuard} from './rules';
import {followupWindow} from '../../deployment-followup/settings';
const input=z.object({githubAutomation:z.object({trigger:z.enum(gitTriggers),statusId:z.string().length(26).nullable(),allowReopen:z.boolean(),expectedVersion:z.number().int().min(0),environment:z.string().trim().min(1).max(200).optional()}).strict()}).strict();
export function addGithubRuleRoutes(app:Hono<AppEnvironment>){
 app.get('/github/automation',async c=>{
  const actor=c.get('operatorId'),workspace=c.get('operator').workspaceId;
  const teams=(await c.env.DB.prepare('SELECT id,name FROM teams WHERE workspace_id=? AND archived_at IS NULL ORDER BY name,id').bind(workspace).all<{id:string;name:string}>()).results;
  const authority=await loadAuthority(c.env.DB,actor,teams.map(t=>t.id));if(!authority||authority.role==='guest'||authority.role==='viewer')throw new IntegrationError(403,'forbidden');
  const result=[];
  for(const team of teams){
   if(decide(authority,{row:'teams.settings',teams:[team.id]})!=='allow')continue;
   const statuses=(await c.env.DB.prepare("SELECT id,name FROM workflow_statuses WHERE team_id=? AND category IN ('backlog','unstarted','started','completed','canceled') ORDER BY position,id").bind(team.id).all<{id:string;name:string}>()).results;
   const rules=await Promise.all(gitTriggers.map(trigger=>gitRule(c.env.DB,team.id,trigger)));
   result.push({...team,statuses,rules,followup:await followupWindow(c.env.DB,team.id)});
  }
  return c.json({teams:result});
 });
 // The existing team-settings door supplies ROLE-009 and the transaction's
 // native-session/role fence. Ordinary team edits continue to their own handler.
 app.patch('/settings/teams/:id',async(c,next)=>{
  const raw=await readRequestJson(c.req.raw.clone() as unknown as Request);
  if(!raw||typeof raw!=='object'||!Object.hasOwn(raw,'githubAutomation'))return next();
  const parsed=input.safeParse(raw);if(!parsed.success)throw new IntegrationError(400,'invalid_github_rule');
  const team=c.req.param('id'),rule=parsed.data.githubAutomation,db=c.env.DB,at=new Date().toISOString();
  const exists=await db.prepare('SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL').bind(team,c.get('operator').workspaceId).first();
  if(!exists)throw new IntegrationError(404,'team_not_found');
  if(rule.statusId&&!await db.prepare("SELECT 1 FROM workflow_statuses WHERE id=? AND team_id=? AND category IN ('backlog','unstarted','started','completed','canceled')").bind(rule.statusId,team).first())throw new IntegrationError(400,'invalid_github_status');
  const current=await gitRule(db,team,rule.trigger);if(current.version!==rule.expectedVersion)throw new IntegrationError(409,'stale_github_rule');
  try{await db.batch([gitGuard(db,'COALESCE((SELECT version FROM github_automation_rules WHERE team_id=? AND trigger=?),0)=?',team,rule.trigger,rule.expectedVersion),
   db.prepare('INSERT INTO github_automation_rules(team_id,trigger,status_id,allow_reopen,version,updated_at,production_environment) VALUES(?,?,?,?,1,?,?) ON CONFLICT(team_id,trigger) DO UPDATE SET status_id=excluded.status_id,allow_reopen=excluded.allow_reopen,version=github_automation_rules.version+1,updated_at=excluded.updated_at,production_environment=excluded.production_environment').bind(team,rule.trigger,rule.statusId,Number(rule.allowReopen),at,rule.environment??current.environment),
   ...audit({db,actor:c.get('operatorId'),workspace:c.get('operator').workspaceId,at},'team.github_rule_changed',team,rule.trigger,current,rule)]);}catch(error){
   // Both requests can pass the read above. The transactional guard is the
   // authority for the loser; only a changed version maps to a stale write.
   if(!/malformed JSON/i.test(String(error)))throw error;
   if((await gitRule(db,team,rule.trigger)).version!==rule.expectedVersion)
    throw new IntegrationError(409,'stale_github_rule');
   throw error;
  }
  return c.json({saved:true,rule:await gitRule(db,team,rule.trigger)});
 });
}
