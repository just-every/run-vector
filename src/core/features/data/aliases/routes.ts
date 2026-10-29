import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment,WorkerBindings} from '../../../app/bindings';
import {requireOperator} from '../../auth/service';
import {visibilityDatabase} from '../../roles/visibility-database';
import {settingsActor,SettingsError} from '../../settings/repository';
import {readRequestJson} from '../../../app/input';
import {createUlid} from '../../../shared/ids';
import {aliasKey,aliasTargetSql} from './identity';
import {searchAdmission} from '../../search/access';
export async function aliasRedirect(env:WorkerBindings,request:Request,value:string,canonical=false) {
 const operator=await requireOperator(env,request);
 if(!operator)return canonical?null:new Response(null,{status:401,headers:{'Cache-Control':'no-store'}});
 const key=value.length<=2000&&!/[\u0000-\u001f]/.test(value)?aliasKey(value)??value.trim():null;if(!key)return canonical?null:new Response(null,{status:404});
 const db=visibilityDatabase(env.DB,operator.id),admission=await searchAdmission(db,operator.id,operator.fence);
 const issue=await db.prepare(`SELECT i.identifier FROM operators actor CROSS JOIN (SELECT ? AS key) lookup
   JOIN issues i ON i.id=${aliasTargetSql('actor.workspace_id','lookup.key')} WHERE ${admission.sql}`)
  .bind(key,...admission.values).first<{identifier:string}>();
 if(canonical&&(!issue||issue.identifier.toUpperCase()===value.toUpperCase()))return null;
 return new Response(null,{status:issue?302:404,headers:{...(issue?{Location:'/app/issues/'+encodeURIComponent(issue.identifier)}:{}),'Cache-Control':'no-store'}});
}
export function addAliasRoutes(app:Hono<AppEnvironment>) {
 app.get('/data/aliases/prefixes',async c=>{
  const actor=await settingsActor(c.env.DB,c.get('operatorId'));
  if(actor.role!=='owner')throw new SettingsError('forbidden','Only the Owner manages imported aliases.',403);
  return c.json({prefixes:(await c.env.DB.prepare('SELECT prefix,active FROM issue_alias_prefixes WHERE workspace_id=? ORDER BY prefix').bind(actor.workspace_id).all()).results});
 });
 app.patch('/data/aliases/prefixes/:prefix',async c=>{
  const actor=await settingsActor(c.env.DB,c.get('operatorId'));
  if(actor.role!=='owner')throw new SettingsError('forbidden','Only the Owner manages imported aliases.',403);
  const input=z.object({active:z.boolean()}).strict().safeParse(await readRequestJson(c.req.raw));
  const prefix=c.req.param('prefix').toUpperCase();
  if(!input.success||!/^[A-Z0-9][A-Z0-9._:-]{0,99}$/i.test(prefix))throw new SettingsError('invalid_alias_prefix','Choose an imported prefix.',400);
  const at=new Date().toISOString();
  await c.env.DB.batch([
   c.env.DB.prepare('UPDATE issue_alias_prefixes SET active=? WHERE workspace_id=? AND prefix=?').bind(Number(input.data.active),actor.workspace_id,prefix),
   c.env.DB.prepare(`INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
    VALUES(?,?,'data.alias_prefix_changed',?,?,?,?)`).bind(createUlid(new Date(at)),c.get('operatorId'),prefix,String(input.data.active),at,at),
  ]);
  return c.json({prefix,active:input.data.active});
 });
}
