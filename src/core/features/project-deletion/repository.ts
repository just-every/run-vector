import { administrationContext, audit, commit, guard, SettingsError } from '../administration/transaction';
import { createUlid } from '../../shared/ids';
import { undoSessionHash } from '../issue-undo/context';

const authority = `EXISTS(SELECT 1 FROM main.operators WHERE id=? AND workspace_id=? AND removed_at IS NULL AND role IN('owner','admin'))`;
// Retained projects use their original issue teams for current content authority.
// An administrative role never grants a private-team content read by itself.
const visible = `EXISTS(SELECT 1 FROM main.operators reader WHERE reader.id=? AND reader.workspace_id=d.workspace_id AND reader.removed_at IS NULL AND reader.role IN('owner','admin') AND
 (reader.role='owner' OR json_array_length(d.members_json)=0
 OR EXISTS(SELECT 1 FROM json_each(d.members_json) m JOIN teams t ON t.id=json_extract(m.value,'$.team_id'))))`;
export async function recentlyDeleted(db:D1Database, actor:string) {
 const access=await administrationContext(db,actor);
 if(!await db.prepare('SELECT '+authority+' allowed').bind(actor,access.workspace).first<number>('allowed'))throw new SettingsError('forbidden','Only Owners and Admins can recover projects.',403);
 return {projects:(await db.prepare(`SELECT d.id,d.project_id AS projectId,d.version,p.name,d.deleted_at AS deletedAt,d.retain_until AS retainUntil,o.name AS actorName
 FROM project_deletions d JOIN main.projects p ON p.id=d.project_id LEFT JOIN operators o ON o.id=d.actor_id
 WHERE d.restored_at IS NULL AND d.workspace_id=? AND ${visible} ORDER BY d.deleted_at DESC,d.id DESC`).bind(access.workspace,actor).all()).results};
}
export async function retainProject(db:D1Database,actor:string,id:string) {
 const ctx=await administrationContext(db,actor);
 const project=await db.prepare('SELECT * FROM projects WHERE id=? AND workspace_id=?').bind(id,ctx.workspace).first<Record<string,unknown>>();
 if(!project)throw new SettingsError('not_found','The selected project is unavailable.',404);
 const receipt=createUlid(new Date(ctx.at)),session=await undoSessionHash(db),until=new Date(Date.parse(ctx.at)+10000).toISOString();
 // Snapshot the original memberships before detaching. The JSON stays local to
 // this transaction; only stable native references are retained in the ledger.
 const members=(await db.prepare('SELECT id,milestone_id,team_id,version+1 AS version FROM main.issues WHERE project_id=?').bind(id).all<{id:string;milestone_id:string|null;team_id:string;version:number}>()).results;
 await commit(ctx,[
  guard(db,authority,actor,ctx.workspace),
  guard(db,'EXISTS(SELECT 1 FROM projects WHERE id=? AND workspace_id=? AND updated_at=?) AND NOT EXISTS(SELECT 1 FROM project_deletions WHERE project_id=? AND restored_at IS NULL)',id,ctx.workspace,String(project.updated_at),id),
  guard(db,"(SELECT json_group_array(json_object('id',id,'milestone_id',milestone_id,'team_id',team_id,'version',version)) FROM (SELECT id,milestone_id,team_id,version+1 AS version FROM main.issues WHERE project_id=? ORDER BY id))=?",id,JSON.stringify([...members].sort((a,b)=>a.id.localeCompare(b.id)))),
  db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
   SELECT substr(?,1,10)||upper(hex(randomblob(8))),id,?,'project.removed',json_object('projectId',project_id,'milestoneId',milestone_id),json_object('projectId',NULL,'milestoneId',NULL),?,? FROM main.issues WHERE project_id=?`).bind(receipt,actor,ctx.at,ctx.at,id),
  db.prepare('UPDATE issues SET project_id=NULL,milestone_id=NULL,version=version+1,updated_at=? WHERE project_id=?').bind(ctx.at,id),
  db.prepare(`INSERT INTO project_deletions(id,project_id,workspace_id,actor_id,deleted_at,retain_until,session_hash,undo_until,members_json) VALUES(?,?,?,?,?,datetime(?,'+30 days'),?,?,?)`).bind(receipt,id,ctx.workspace,actor,ctx.at,ctx.at,session,until,JSON.stringify(members)),
  ...members.map(member=>db.prepare('INSERT INTO project_deletion_memberships(deletion_id,issue_id,milestone_id) VALUES(?,?,?)').bind(receipt,member.id,member.milestone_id)),
  db.prepare(`INSERT INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,'project.deleted',?,?,?,?)`).bind(createUlid(new Date(ctx.at)),id,actor,'null',JSON.stringify({deletionId:receipt}),ctx.at,ctx.at),
  ...audit(ctx,'project.removed',id,String(project.name),null,{deletionId:receipt}),
 ]);
 return session?{id:receipt,projectId:id,version:1,expiresAt:Date.parse(until)}:null;
}
export async function restoreProject(db:D1Database,actor:string,input:{id:string;version:number;undo?:boolean}) {
 const ctx=await administrationContext(db,actor),session=await undoSessionHash(db);
 const condition=`d.id=? AND d.version=? AND d.restored_at IS NULL AND julianday(d.retain_until)>julianday('now') AND ${visible}
 ${input.undo?`AND (SELECT count(*) FROM project_deletion_memberships m WHERE m.deletion_id=d.id)=json_array_length(d.members_json) AND d.session_hash=? AND d.actor_id=? AND julianday(d.undo_until)>julianday('now') AND NOT EXISTS(SELECT 1 FROM json_each(d.members_json) m LEFT JOIN main.issues i ON i.id=json_extract(m.value,'$.id') WHERE i.id IS NULL OR i.version<>json_extract(m.value,'$.version') OR i.project_id IS NOT NULL OR i.milestone_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM project_deletions later WHERE later.rowid>d.rowid AND later.actor_id=d.actor_id AND later.session_hash=d.session_hash)`:''}`;
 const values=[input.id,input.version,actor,...(input.undo?[session,actor]:[])];
 const row=await db.prepare(`SELECT d.project_id projectId FROM project_deletions d WHERE ${condition}`).bind(...values).first<{projectId:string}>();
 if(!row)throw new SettingsError('restore_conflict','Nothing changed. This recovery receipt is stale, expired or unavailable.',409);
 // The first assertion and state transition serialize repeat and concurrent
 // restores. Restoring the tombstone first admits retained native relations.
 await commit(ctx,[
  guard(db,`EXISTS(SELECT 1 FROM project_deletions d WHERE ${condition})`,...values),
  db.prepare('UPDATE project_deletions SET restored_at=?,version=version+1,session_hash=NULL WHERE id=? AND version=? AND restored_at IS NULL').bind(ctx.at,input.id,input.version),
  db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
   SELECT substr(?,1,10)||upper(hex(randomblob(8))),i.id,?,'project.restored',json_object('projectId',NULL,'milestoneId',NULL),json_object('projectId',?,'milestoneId',m.milestone_id),?,?
   FROM project_deletion_memberships m JOIN main.issues i ON i.id=m.issue_id WHERE m.deletion_id=? AND i.project_id IS NULL AND i.milestone_id IS NULL`).bind(createUlid(new Date(ctx.at)),actor,row.projectId,ctx.at,ctx.at,input.id),
  db.prepare(`UPDATE issues SET project_id=?,milestone_id=(SELECT milestone_id FROM project_deletion_memberships m WHERE m.issue_id=issues.id AND m.deletion_id=?),version=version+1,updated_at=?
   WHERE id IN(SELECT issue_id FROM project_deletion_memberships WHERE deletion_id=?) AND project_id IS NULL AND milestone_id IS NULL`).bind(row.projectId,input.id,ctx.at,input.id),
  db.prepare(`INSERT INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,'project.restored',?,?,?,?)`).bind(createUlid(new Date(ctx.at)),row.projectId,actor,JSON.stringify({deletionId:input.id}),'null',ctx.at,ctx.at),
  ...audit(ctx,'project.restored',row.projectId,'Restored project',null,{deletionId:input.id}),
 ]);
 return {projectId:row.projectId};
}
