import type {Hono} from 'hono';
import type {AppEnvironment} from '../../app/bindings';
import {readRequestJson} from '../../app/input';
import {audit} from '../administration/transaction';
import {IntegrationError} from '../integrations/errors';
import {gitGuard} from '../integrations/github/rules';
import {followupInput,type FollowupWindow} from './schema';

export async function followupWindow(db:D1Database,team:string):Promise<FollowupWindow>{
 return await db.prepare('SELECT window_hours AS windowHours,version,enabled_at AS enabledAt FROM team_deployment_followups WHERE team_id=?').bind(team).first<FollowupWindow>()
  ??{windowHours:null,version:0,enabledAt:null};
}

// The existing team-settings door supplies ROLE-009 (team owners, or every
// member under All team members; never Viewers or Guests) and the
// transaction's native-session and role fence, as for Git automation rules.
export function addFollowupRoutes(app:Hono<AppEnvironment>){
 app.patch('/settings/teams/:id',async(c,next)=>{
  const raw=await readRequestJson(c.req.raw.clone() as unknown as Request);
  if(!raw||typeof raw!=='object'||!Object.hasOwn(raw,'deploymentFollowup'))return next();
  const parsed=followupInput.safeParse(raw);if(!parsed.success)throw new IntegrationError(400,'invalid_deployment_followup');
  const team=c.req.param('id'),db=c.env.DB,at=new Date().toISOString(),input=parsed.data.deploymentFollowup;
  const exists=await db.prepare('SELECT name FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL').bind(team,c.get('operator').workspaceId).first<{name:string}>();
  if(!exists)throw new IntegrationError(404,'team_not_found');
  const current=await followupWindow(db,team);if(current.version!==input.expectedVersion)throw new IntegrationError(409,'stale_deployment_followup');
  // Turning a window on follows merges received from now; changing its length
  // keeps that start, and turning it off is the explicit stop for every pending watch.
  const enabledAt=input.windowHours===null?null:current.enabledAt??at;
  try{await db.batch([gitGuard(db,'COALESCE((SELECT version FROM team_deployment_followups WHERE team_id=?),0)=?',team,input.expectedVersion),
   db.prepare(`INSERT INTO team_deployment_followups(team_id,window_hours,enabled_at,configured_by,version,updated_at) VALUES(?,?,?,?,1,?)
    ON CONFLICT(team_id) DO UPDATE SET window_hours=excluded.window_hours,enabled_at=excluded.enabled_at,configured_by=excluded.configured_by,version=team_deployment_followups.version+1,updated_at=excluded.updated_at`)
    .bind(team,input.windowHours,enabledAt,c.get('operatorId'),at),
   ...audit({db,actor:c.get('operatorId'),workspace:c.get('operator').workspaceId,at},'team.deployment_followup_changed',team,exists.name,current,input)]);}catch(error){
   // Both requests can pass the read above; the guard decides the loser.
   if(!/malformed JSON/i.test(String(error)))throw error;
   if((await followupWindow(db,team)).version!==input.expectedVersion)throw new IntegrationError(409,'stale_deployment_followup');
   throw error;
  }
  return c.json({saved:true,followup:await followupWindow(db,team)});
 });
}
