import { audit } from './transaction';
import type { z } from "zod";
import { createUlid } from "../../shared/ids";
import { projectActivity } from "./project-fields";
import type { projectMilestoneCreateSchema, projectMilestoneUpdateSchema } from "./schema";
import {
  administrationContext, ownedRow, guard, commit, SettingsError,
  type AdministrationContext,
} from "./transaction";

type Milestone = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  target_date: string | null;
  position: number;
  completed: number;
  updated_at: string;
};

async function milestones(ctx: AdministrationContext, projectId: string) {
  await ownedRow(ctx, "projects", projectId);
  return (await ctx.db.prepare(
    "SELECT id,project_id,name,description,target_date,position,completed,updated_at FROM project_milestones WHERE project_id=? ORDER BY position,id",
  ).bind(projectId).all<Milestone>()).results;
}

function milestonesGuard(ctx: AdministrationContext, projectId: string, rows: Milestone[]) {
  return guard(ctx.db,
    `EXISTS(SELECT 1 FROM projects WHERE id=? AND workspace_id=?) AND
     (SELECT json_group_array(json_array(id,name,description,target_date,position,completed,updated_at))
      FROM (SELECT * FROM project_milestones WHERE project_id=? ORDER BY position,id))=?`,
    projectId, ctx.workspace, projectId,
    JSON.stringify(rows.map((row) => [row.id,row.name,row.description,row.target_date,row.position,row.completed,row.updated_at])),
  );
}

function milestoneValue(row: Milestone) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    description: row.description, targetDate: row.target_date,
    position: row.position, completed: Boolean(row.completed),
  };
}

function requiredMilestone(rows: Milestone[], id: string) {
  const milestone = rows.find((row) => row.id === id);
  if (!milestone) throw new SettingsError("not_found", "Milestone is unavailable in this project.", 404);
  return milestone;
}

export async function createProjectMilestone(
  db: D1Database, actor: string, projectId: string,
  input: z.infer<typeof projectMilestoneCreateSchema>,
) {
  const ctx = await administrationContext(db, actor);
  const rows = await milestones(ctx, projectId);
  const id = createUlid(new Date(ctx.at));
  const position = rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.position)) + 1;
  await commit(ctx, [
    milestonesGuard(ctx, projectId, rows),
    ctx.db.prepare(
      `INSERT INTO project_milestones(id,project_id,name,description,target_date,position,completed,created_at,updated_at)
       VALUES(?,?,?,?,?,?,0,?,?)`,
    ).bind(id,projectId,input.name,input.description,input.targetDate,position,ctx.at,ctx.at),
    projectActivity(ctx, projectId, "project.milestone_created", null, {
      id,projectId,...input,position,completed:false,
    }),
  ]);
  return id;
}

export async function updateProjectMilestone(
  db: D1Database, actor: string, projectId: string, id: string,
  input: z.infer<typeof projectMilestoneUpdateSchema>,
) {
  const ctx = await administrationContext(db, actor);
  const rows = await milestones(ctx, projectId);
  const old = requiredMilestone(rows, id);
  const previous = milestoneValue(old);
  const next = { ...previous, ...input };
  if (JSON.stringify(previous) === JSON.stringify(next)) return;
  await commit(ctx, [
    milestonesGuard(ctx, projectId, rows),
    ctx.db.prepare(
      "UPDATE project_milestones SET name=?,description=?,target_date=?,completed=?,updated_at=? WHERE id=? AND project_id=?",
    ).bind(next.name,next.description,next.targetDate,Number(next.completed),ctx.at,id,projectId),
    projectActivity(ctx, projectId, "project.milestone_updated", previous, next),
  ]);
}

export async function reorderProjectMilestones(
  db: D1Database, actor: string, projectId: string, ids: string[],
) {
  const ctx = await administrationContext(db, actor);
  const rows = await milestones(ctx, projectId);
  if (ids.length !== rows.length || new Set(ids).size !== ids.length ||
      ids.some((id) => !rows.some((row) => row.id === id))) {
    throw new SettingsError("invalid_order", "Provide every milestone in this project exactly once.", 400);
  }
  if (rows.every((row, index) => row.id === ids[index] && row.position === index)) return;
  const offset = Math.max(rows.length, ...rows.map((row) => row.position)) + 1;
  await commit(ctx, [
    milestonesGuard(ctx, projectId, rows),
    ...ids.map((id, index) => ctx.db.prepare(
      "UPDATE project_milestones SET position=? WHERE id=? AND project_id=?",
    ).bind(offset + index,id,projectId)),
    ...ids.map((id, index) => ctx.db.prepare(
      "UPDATE project_milestones SET position=?,updated_at=? WHERE id=? AND project_id=?",
    ).bind(index,ctx.at,id,projectId)),
    projectActivity(ctx, projectId, "project.milestones_reordered", rows.map((row) => row.id), ids),
  ]);
}

export async function removeProjectMilestone(
  db: D1Database, actor: string, projectId: string, id: string,
) {
  const ctx = await administrationContext(db, actor);
  const rows = await milestones(ctx, projectId);
  const old = requiredMilestone(rows, id);
  const operationId = createUlid(new Date(ctx.at));
  await commit(ctx, [
    milestonesGuard(ctx, projectId, rows),
    ctx.db.prepare(
      `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
       SELECT ?||':'||id,id,?,'project.milestone_removed',json_object('milestoneId',milestone_id),json_object('milestoneId',NULL),?,?
       FROM issues WHERE project_id=? AND milestone_id=?`,
    ).bind(operationId,actor,ctx.at,ctx.at,projectId,id),
    ctx.db.prepare(
      "UPDATE issues SET milestone_id=NULL,version=version+1,updated_at=? WHERE project_id=? AND milestone_id=?",
    ).bind(ctx.at,projectId,id),
    ctx.db.prepare("DELETE FROM project_milestones WHERE id=? AND project_id=?").bind(id,projectId),
    ...audit(ctx, "project.milestone_removed", id, id, null, null),
    projectActivity(ctx, projectId, "project.milestone_removed", milestoneValue(old), null),
  ]);
}
