import {createUlid} from '../../../shared/ids';
import {followerChangeStatements,blockerStatements,finalizeEvent} from '../../notifications/events';
import {IntegrationError} from '../errors';
export async function regressionStatements(db:D1Database,issueId:string,source:{name:string;team_id:string},rule:string,actor:string,regression:boolean,at:string){
 if(!regression||rule==='ignore')return [];
 const issue=await db.prepare('SELECT i.version,i.status_id AS statusId,i.team_id AS teamId,s.category FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.id=?').bind(issueId).first<{version:number;statusId:string;teamId:string;category:string}>();
 if(!issue||issue.teamId!==source.team_id||['canceled','duplicate'].includes(issue.category))return [];
 const guard=db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM issues WHERE id=? AND version=?) THEN 1 ELSE json('error issue changed') END").bind(issueId,issue.version);
 const id=createUlid(new Date(at)),event={id,issueId,actor:null,actorName:source.name,at};
 if(rule==='comment'){
  const comment=createUlid(new Date(at));
  return [guard,db.prepare('INSERT INTO issue_comments(id,issue_id,actor_operator_id,imported_author_name,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(comment,issueId,actor,source.name,'Regression reported by '+source.name+'.',at,at),db.prepare("INSERT INTO issue_activity(id,issue_id,actor_name,kind,next_value_json,created_at,updated_at) VALUES(?,?,?,'comment.created',?,?,?)").bind(id,issueId,source.name,JSON.stringify({id:comment}),at,at)];
 }
 if(issue.category!=='completed')return [];
 const target=await db.prepare("SELECT id FROM workflow_statuses WHERE team_id=? AND category IN ('started','unstarted','backlog') ORDER BY CASE category WHEN 'started' THEN 0 WHEN 'unstarted' THEN 1 ELSE 2 END,position,id LIMIT 1").bind(issue.teamId).first<{id:string}>();
 if(!target)throw new IntegrationError(409,'regression_status_unavailable');
 return [guard,db.prepare('UPDATE issues SET status_id=?,completed_at=NULL,version=version+1,updated_at=? WHERE id=?').bind(target.id,at,issueId),db.prepare("INSERT INTO issue_activity(id,issue_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,'issue.status_changed',?,?,?,?)").bind(id,issueId,source.name,JSON.stringify({statusId:issue.statusId}),JSON.stringify({statusId:target.id,automation:'error_regression'}),at,at),...blockerStatements(db,event),...followerChangeStatements(db,event),...finalizeEvent(db,event)];
}
