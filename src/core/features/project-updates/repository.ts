import type { z } from "zod";
import { settingsActor } from "../settings/repository";
import { IntegrationError } from "../integrations/errors";
import { activeRecipient } from "../notifications/events";
import { gitGuard } from "../integrations/github/rules";
import { updateAuthority, visibleProject } from "./authority";
import type { ProjectUpdate, projectUpdateInput } from "./schema";

const projection = `SELECT u.id,u.project_id projectId,u.author_operator_id authorId,
  COALESCE(o.name,'Removed operator') authorName,u.status,u.body,u.created_at createdAt
  FROM project_updates u LEFT JOIN operators o ON o.id=u.author_operator_id`;
export async function readProjectUpdates(db:D1Database, project:string):Promise<ProjectUpdate[]> {
  return (await db.prepare(projection+' WHERE u.project_id=? ORDER BY u.created_at DESC,u.id DESC').bind(project).all<ProjectUpdate>()).results;
}
export async function postProjectUpdate(db:D1Database, actor:string, project:string, input:z.infer<typeof projectUpdateInput>) {
  const access=await settingsActor(db,actor);
  if(!await db.prepare('SELECT id FROM projects WHERE id=? AND workspace_id=?').bind(project,access.workspace_id).first())
    throw new IntegrationError(404,'project_not_found');
  if(!await db.prepare('SELECT ('+updateAuthority+') allowed').bind(project,actor).first<number>('allowed'))
    throw new IntegrationError(403,'project_update_forbidden');
  const existing=await db.prepare('SELECT project_id,author_operator_id,status,body FROM project_updates WHERE id=?').bind(input.id)
    .first<{project_id:string;author_operator_id:string;status:string;body:string}>();
  if(existing&&(existing.project_id!==project||existing.author_operator_id!==actor||existing.status!==input.status||existing.body!==input.body))
    throw new IntegrationError(409,'project_update_conflict');
  const at=new Date().toISOString();
  const source=`u.id=? AND u.project_id=? AND u.author_operator_id=? AND u.status=? AND u.body=?`;
  const values=[input.id,project,actor,input.status,input.body];
  const fresh=`NOT EXISTS(SELECT 1 FROM project_activity a WHERE a.id=u.id)`;
  await db.batch([
    gitGuard(db,updateAuthority,project,actor),
    db.prepare(`INSERT INTO project_updates(id,project_id,author_operator_id,status,body,created_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(...values,at),
    gitGuard(db,'EXISTS(SELECT 1 FROM project_updates u WHERE '+source+')',...values),
    db.prepare(`INSERT OR IGNORE INTO project_update_notifications(id,update_id,project_id,recipient_id,created_at)
      SELECT lower(hex(randomblob(16))),u.id,p.id,o.id,u.created_at
      FROM project_updates u JOIN projects p ON p.id=u.project_id
      JOIN main.operators o ON ${visibleProject('o','p')}
      JOIN subject_subscriptions s ON s.subject_type='project' AND s.subject_id=p.id AND s.operator_id=o.id
      WHERE ${source} AND ${fresh} AND ${activeRecipient} AND o.id<>u.author_operator_id
      AND NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind='project_update')
      AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
      AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`).bind(...values),
    db.prepare(`INSERT OR IGNORE INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT u.id,u.project_id,u.author_operator_id,'project.update_posted','null',json_object('updateId',u.id,'status',u.status),u.created_at,u.created_at
      FROM project_updates u WHERE ${source}`).bind(...values),
    gitGuard(db,updateAuthority,project,actor),
  ]);
  const saved=await db.prepare(projection+' WHERE u.id=? AND u.project_id=?').bind(input.id,project).first<ProjectUpdate>();
  if(!saved)throw new IntegrationError(404,'project_not_found');
  return saved;
}
