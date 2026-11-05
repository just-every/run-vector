import { administrationContext, commit, guard, ownedRow, SettingsError } from '../administration/transaction';
import { projectActivity } from '../administration/project-fields';
import { createUlid } from '../../shared/ids';
import { projectDependencyNotices } from './notifications';
import type { DirectProjectDependencies } from './schema';

export async function readProjectDependencies(db: D1Database, id: string): Promise<DirectProjectDependencies> {
  const rows = (await db.prepare(`SELECT d.id,d.blocked_project_id blocked,d.blocking_project_id blocking,
    a.name blockedName,b.name blockingName FROM project_dependencies d
    JOIN projects a ON a.id=d.blocked_project_id JOIN projects b ON b.id=d.blocking_project_id
    WHERE a.id=? OR b.id=? ORDER BY d.id`).bind(id,id).all<{
      id: string; blocked: string; blocking: string; blockedName: string; blockingName: string;
    }>()).results;
  return {
    blockedBy: rows.filter(row=>row.blocked===id).map(row=>({id:row.id,project:{id:row.blocking,name:row.blockingName}})),
    blocking: rows.filter(row=>row.blocking===id).map(row=>({id:row.id,project:{id:row.blocked,name:row.blockedName}})),
  };
}

/** Every commit contains the edge, one activity at each endpoint and the lead
 * Inbox records. The database trigger checks the entire graph inside the write
 * transaction, even when some of its intermediate projects are hidden.
 */
export async function setProjectDependency(source: D1Database, actor: string, blocked: string, blocking: string, present: boolean) {
  const ctx = await administrationContext(source,actor);
  if(!['owner','admin','member'].includes((await ctx.db.prepare('SELECT role FROM operators WHERE id=?').bind(actor).first<string>('role'))??''))
    throw new SettingsError('forbidden','Your workspace role does not allow this action.',403);
  await ownedRow(ctx,'projects',blocked);
  await ownedRow(ctx,'projects',blocking);
  if(blocked===blocking)throw new SettingsError('project_dependency_cycle','A project cannot block itself or close a cycle.',400);
  for(let attempt=0;attempt<3;attempt++) {
    const old = await ctx.db.prepare('SELECT id FROM project_dependencies WHERE blocked_project_id=? AND blocking_project_id=?')
      .bind(blocked,blocking).first<{id:string}>();
    if(Boolean(old)===present)return;
    const id=old?.id??createUlid(new Date(ctx.at));
    const value={dependencyId:id,blockedProjectId:blocked,blockingProjectId:blocking};
    const kind=present?'project.dependency_added':'project.dependency_removed';
    const event=createUlid(new Date(ctx.at));
    try {
      await commit(ctx,[
        // Recheck current endpoint visibility and authority in the graph batch.
        guard(ctx.db,'EXISTS(SELECT 1 FROM projects WHERE id=? AND workspace_id=?) AND EXISTS(SELECT 1 FROM projects WHERE id=? AND workspace_id=?)',blocked,ctx.workspace,blocking,ctx.workspace),
        guard(ctx.db,"EXISTS(SELECT 1 FROM operators WHERE id=? AND role IN('owner','admin','member') AND removed_at IS NULL)",actor),
        ...(old?[guard(ctx.db,'EXISTS(SELECT 1 FROM project_dependencies WHERE id=?)',old.id)]:[]),
        present
          ?ctx.db.prepare('INSERT INTO project_dependencies(id,workspace_id,blocked_project_id,blocking_project_id,created_at) VALUES(?,?,?,?,?)').bind(id,ctx.workspace,blocked,blocking,ctx.at)
          :ctx.db.prepare('DELETE FROM project_dependencies WHERE id=?').bind(id),
        ctx.db.prepare('INSERT INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
          .bind(event,blocked,actor,kind,JSON.stringify(present?null:value),JSON.stringify(present?value:null),ctx.at,ctx.at),
        projectActivity(ctx,blocking,kind,present?null:value,present?value:null),
        projectDependencyNotices(ctx.db,event,blocked,blocking,actor,ctx.at),
      ]);
      return;
    } catch(error) {
      if(/project_dependency_cycle/.test(String(error)))
        throw new SettingsError('project_dependency_cycle','A project cannot block itself or close a cycle.',400);
      if(/invalid_project_dependency/.test(String(error)))
        throw new SettingsError('not_found','The selected record is unavailable.',404);
      // A competing identical request may have won. Re-read only duplicate or
      // stale-edge conflicts; never retry admission, notification or I/O errors.
      if(!(error instanceof SettingsError&&error.code==='administration_conflict')||attempt===2)throw error;
    }
  }
}
