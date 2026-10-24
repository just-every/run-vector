import { createUlid } from '../../../shared/ids';
import { followerChangeStatements, blockerStatements, finalizeEvent } from '../../notifications/events';
import type {GitRule,GitTrigger} from './rule-schema';
export {gitTriggers} from './rule-schema';
export type {GitRule,GitTrigger} from './rule-schema';
const defaults={draft:'in progress',review:'in review',merged:'done',deploy:null};
export const gitGuard=(db:D1Database,sql:string,...values:(string|number|null)[])=>db.prepare(`SELECT CASE WHEN (${sql}) THEN 1 ELSE json('github transaction denied') END`).bind(...values);
export async function gitRule(db:D1Database,team:string,trigger:GitTrigger):Promise<GitRule>{
 const configured=await db.prepare('SELECT status_id AS statusId,allow_reopen AS allowReopen,version,production_environment AS environment FROM github_automation_rules WHERE team_id=? AND trigger=?').bind(team,trigger).first<Omit<GitRule,'trigger'>>();
 if(configured)return {trigger,...configured};
 const status=defaults[trigger] ? await db.prepare('SELECT id FROM workflow_statuses WHERE team_id=? AND lower(name)=? ORDER BY position,id LIMIT 1').bind(team,defaults[trigger]).first<{id:string}>():null;
 return {trigger,statusId:status?.id??null,allowReopen:0,version:0,environment:'production'};
}
/** Prepared inside the signed delivery transaction; receipt, move and notices
 * commit together. The actor is a system identity, never the webhook sender. */
export async function gitMove(db:D1Database,issueId:string,trigger:GitTrigger,at:string){
 const issue=await db.prepare('SELECT i.team_id AS team,i.status_id AS statusId,i.version,s.category FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.id=?').bind(issueId).first<{team:string;statusId:string;version:number;category:string}>();
 if(!issue)return [];
 const rule=await gitRule(db,issue.team,trigger);
 const fence=gitGuard(db,'COALESCE((SELECT version FROM github_automation_rules WHERE team_id=? AND trigger=?),0)=?',issue.team,trigger,rule.version);
 if(!rule.statusId||rule.statusId===issue.statusId||issue.category==='intake')return [fence];
 const target=await db.prepare('SELECT category FROM workflow_statuses WHERE id=? AND team_id=?').bind(rule.statusId,issue.team).first<{category:string}>();
 if(!target||!['backlog','unstarted','started','completed','canceled'].includes(target.category)||(issue.category==='completed'&&target.category!=='completed'&&!rule.allowReopen))return [fence];
 const id=createUlid(new Date(at)),event={id,issueId,actor:null,actorName:'Git automation',at};
 const previous=JSON.stringify({statusId:issue.statusId}),next=JSON.stringify({statusId:rule.statusId,automation:'git',trigger});
 return [fence,gitGuard(db,'EXISTS(SELECT 1 FROM issues WHERE id=? AND version=? AND status_id=?)',issueId,issue.version,issue.statusId),
 db.prepare("INSERT INTO issue_activity(id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,NULL,'Git automation','issue.status_changed',?,?,?,?)").bind(id,issueId,previous,next,at,at),
 ...blockerStatements(db,event),
 db.prepare('UPDATE issues SET status_id=?,completed_at=?,canceled_at=?,deferred_until=NULL,version=version+1,updated_at=? WHERE id=?').bind(rule.statusId,target.category==='completed'?at:null,target.category==='canceled'?at:null,at,issueId),
 db.prepare("INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at) SELECT ?,NULL,'issue.status_changed',identifier,id,?,? FROM issues WHERE id=?").bind(id,at,at,issueId),
 ...followerChangeStatements(db,event),...finalizeEvent(db,event)];
}
