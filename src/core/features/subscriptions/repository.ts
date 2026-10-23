import {createUlid} from '../../shared/ids';
import {settingsActor} from '../settings/repository';
import {IntegrationError} from '../integrations/errors';
import {gitGuard} from '../integrations/github/rules';
import {subjectTypes,type SubjectType,type Subscription} from './schema';
type Selection={sql:string;values:(string|number|null)[]};
export function subjectSelection(type:SubjectType,id:string|undefined,workspace:string,actor:string):Selection{
 const bound=id?' AND s.id=?':'',values:(string|number|null)[]=[workspace,...(id?[id]:[])];
 if(type==='team')return {sql:'SELECT s.id,s.name FROM teams s WHERE s.workspace_id=?'+bound,values};
 if(type==='project')return {sql:'SELECT s.id,s.name FROM projects s WHERE s.workspace_id=?'+bound,values};
 if(type==='label')return {sql:"SELECT s.id,s.name FROM labels s WHERE s.workspace_id=?"+bound+" AND ((SELECT role FROM operators WHERE id=?)<>'guest' OR EXISTS(SELECT 1 FROM issue_labels l JOIN issues i ON i.id=l.issue_id WHERE l.label_id=s.id))",values:[...values,actor]};
 if(type==='view')return {sql:'SELECT s.id,s.name FROM saved_views s WHERE s.workspace_id=?'+bound+' AND (s.owner_operator_id=? OR s.is_shared=1)',values:[...values,actor]};
 throw new IntegrationError(400,'invalid_subscription_subject');
}
export const subjectUrl=(type:SubjectType,id:string)=>type==='project'?'/app/projects/'+id:type==='view'?'/app/views/'+id:'/app/issues?'+(type==='team'?'team':'label')+'='+id;
export async function subscriptions(db:D1Database,actor:string){
 const access=await settingsActor(db,actor);
 const subjects=[];
 for(const type of subjectTypes){const q=subjectSelection(type,undefined,access.workspace_id,actor);for(const row of (await db.prepare(q.sql+' ORDER BY s.name,s.id LIMIT 500').bind(...q.values).all<{id:string;name:string}>()).results)subjects.push({subjectType:type,subjectId:row.id,name:row.name,url:subjectUrl(type,row.id)});}
 const rows=(await db.prepare('SELECT id,subject_type AS subjectType,subject_id AS subjectId,start_revision AS startRevision FROM subject_subscriptions WHERE operator_id=? ORDER BY created_at,id').bind(actor).all<Subscription>()).results;
 return {subjects,subscriptions:await Promise.all(rows.map(async row=>{
  const q=subjectSelection(row.subjectType,row.subjectId,access.workspace_id,actor),subject=await db.prepare(q.sql).bind(...q.values).first<{name:string}>();
  return {...row,name:subject?.name??'Unavailable subject',available:Boolean(subject),url:subject?subjectUrl(row.subjectType,row.subjectId):''};
 }))};
}
export async function subscribe(db:D1Database,actor:string,type:SubjectType,subjectId:string){
 const access=await settingsActor(db,actor),q=subjectSelection(type,subjectId,access.workspace_id,actor);
 if(!await db.prepare(q.sql).bind(...q.values).first())throw new IntegrationError(404,'subject_not_found');
 const existing=await db.prepare('SELECT id FROM subject_subscriptions WHERE operator_id=? AND subject_type=? AND subject_id=?').bind(actor,type,subjectId).first<{id:string}>();
 if(existing)return {id:existing.id};
 if((await db.prepare('SELECT count(*) AS n FROM subject_subscriptions WHERE operator_id=?').bind(actor).first<number>('n'))!>=100)throw new IntegrationError(409,'subscription_limit','Manage up to 100 subject subscriptions.');
 const id=createUlid(new Date()),at=new Date().toISOString();
 await db.batch([gitGuard(db,'EXISTS('+q.sql+')',...q.values),
 db.prepare('INSERT INTO subject_subscriptions(id,operator_id,subject_type,subject_id,start_revision,created_at) SELECT ?,?,?,?,revision,? FROM subscription_clock WHERE id=1 ON CONFLICT(operator_id,subject_type,subject_id) DO NOTHING').bind(id,actor,type,subjectId,at)]);
 return (await db.prepare('SELECT id FROM subject_subscriptions WHERE operator_id=? AND subject_type=? AND subject_id=?').bind(actor,type,subjectId).first<{id:string}>())!;
}
export async function unsubscribe(db:D1Database,actor:string,id:string){
 const row=await db.prepare('SELECT id FROM subject_subscriptions WHERE id=? AND operator_id=?').bind(id,actor).first();if(!row)throw new IntegrationError(404,'subscription_not_found');
 await db.prepare('DELETE FROM subject_subscriptions WHERE id=? AND operator_id=?').bind(id,actor).run();return {removed:true};
}
