import { ownerPredicate } from '../integrations/authority';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { createUlid } from '../../shared/ids';
import { sha256 } from '../../../../vendor/base/integrations/core/crypto';
import { administrationContext, audit, commit, guard, SettingsError } from '../administration/transaction';
import { visibleTeam } from '../roles/visibility-sql';

export const installActorSchema = z.object({name:z.string().trim().min(1).max(100),teamId:z.string().length(26),scopes:z.array(z.enum(['issues:read','issues:title:write'])).min(1).max(2).refine(v=>new Set(v).size===v.length && v.includes('issues:read'))}).strict();
export const actorStateSchema=z.object({state:z.enum(['paused','revoked'])}).strict();
async function management(db: D1Database, actor: string) {
 const ctx = await administrationContext(db,actor);
 if (!await db.prepare("SELECT 1 FROM operators WHERE id=? AND role IN ('owner','admin') AND removed_at IS NULL").bind(actor).first())
  throw new SettingsError('forbidden','Only Owners and Admins manage installed agents.',403);
 return ctx;
}
function managementGuard(ctx: Awaited<ReturnType<typeof management>>, session: {sessionId:string;operatorVersion:number}) {
 const predicate=ownerPredicate({id:ctx.actor,workspace:ctx.workspace,fence:session});
 return guard(ctx.db,`(${predicate.sql}) AND EXISTS(SELECT 1 FROM operators WHERE id=? AND role IN ('owner','admin'))`,...predicate.params!,ctx.actor);
}
export function addAppActorRoutes(parent: Hono<AppEnvironment>) {
 const app=new Hono<AppEnvironment>();
 app.onError((error,c)=>{
  if(error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);
  if(error instanceof z.ZodError)return c.json({error:'invalid_request',message:'Choose a name, a visible team and explicit issue permissions.'},400);
  throw error;
 });
 app.get('/settings/app-actors',async c=>{
  const ctx=await management(c.env.DB,c.get('operatorId'));
  const rows=await c.env.DB.prepare(`SELECT a.id,a.name,a.installer_id AS installerId,a.installer_name AS installerName,a.team_id AS teamId,a.scopes,a.state,a.created_at AS createdAt,
   NOT EXISTS(SELECT 1 FROM vector_app_actor_credentials k WHERE k.actor_id=a.id) AS requiresReentry FROM vector_app_actors a WHERE a.workspace_id=? ORDER BY a.created_at,a.id`).bind(ctx.workspace).all<{scopes:string}>();
  await management(c.env.DB,c.get('operatorId'));
  return c.json({actors:rows.results.map(row=>({...row,scopes:JSON.parse(row.scopes)}))});
 });
 app.post('/settings/app-actors',async c=>{
  const input=installActorSchema.parse(await readRequestJson(c.req.raw)),ctx=await management(c.env.DB,c.get('operatorId'));
  const id=createUlid(new Date(ctx.at)),token='act_'+Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
  const person=await c.env.DB.prepare('SELECT name FROM operators WHERE id=?').bind(ctx.actor).first<string>('name');
  await commit(ctx,[
   guard(ctx.db,`EXISTS(SELECT 1 FROM teams t JOIN operators o ON o.id=? WHERE t.id=? AND t.workspace_id=? AND t.archived_at IS NULL AND ${visibleTeam('o','t.id')})`,ctx.actor,input.teamId,ctx.workspace),
   ctx.db.prepare("INSERT INTO vector_app_actors(id,workspace_id,name,installer_id,installer_name,team_id,scopes,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'active',?,?)").bind(id,ctx.workspace,input.name,ctx.actor,person,input.teamId,JSON.stringify(input.scopes),ctx.at,ctx.at),
   ctx.db.prepare("INSERT INTO vector_app_actor_credentials(actor_id,token_hash,dev_only) VALUES(?,?,COALESCE((SELECT kind='dev' FROM oa_sessions WHERE id=?),0))").bind(id,await sha256(token),c.get('operator').fence.sessionId),
   ...audit(ctx,'app_agent.installed',id,id,null,{name:input.name,teamId:input.teamId,scopes:input.scopes}),
   managementGuard(ctx,c.get('operator').fence),
   guard(ctx.db,`EXISTS(SELECT 1 FROM teams t JOIN operators o ON o.id=? WHERE t.id=? AND t.workspace_id=? AND t.archived_at IS NULL AND ${visibleTeam('o','t.id')})`,ctx.actor,input.teamId,ctx.workspace),
  ]);
  return c.json({id,token},201);
 });
 app.patch('/settings/app-actors/:id',async c=>{
  const {state}=actorStateSchema.parse(await readRequestJson(c.req.raw)),ctx=await management(c.env.DB,c.get('operatorId')),id=c.req.param('id');
  const previous=await ctx.db.prepare('SELECT state FROM vector_app_actors WHERE id=? AND workspace_id=?').bind(id,ctx.workspace).first<{state:string}>();
  if (!previous) throw new SettingsError('not_found','The installed agent is unavailable.',404);
  if (previous.state==='revoked' || previous.state===state) return c.json({id,state:previous.state});
  await commit(ctx,[
   guard(ctx.db,'EXISTS(SELECT 1 FROM vector_app_actors WHERE id=? AND workspace_id=? AND state=?)',id,ctx.workspace,previous.state),
   ctx.db.prepare('UPDATE vector_app_actors SET state=?,updated_at=? WHERE id=? AND workspace_id=?').bind(state,ctx.at,id,ctx.workspace),
   ...(state==='revoked'?[ctx.db.prepare('DELETE FROM vector_app_actor_credentials WHERE actor_id=?').bind(id)]:[]),
   ...audit(ctx,'app_agent.'+state,id,id,{state:previous.state},{state}),
   managementGuard(ctx,c.get('operator').fence),
  ]);
  return c.json({id,state});
 });
 parent.route('/',app);
}
