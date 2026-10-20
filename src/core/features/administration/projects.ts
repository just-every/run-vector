import { captureDailyReports } from "../project-report/capture";
import { z } from "zod";
import { validateProjectDates, projectActivity as activity, readProjectLabelIds, projectLabelWrites, projectFieldActivity } from "./project-fields";
import { createUlid } from "../../shared/ids";
import { projectCreateSchema, projectUpdateSchema } from "./schema";
import {
  administrationContext,
  ownedRow,
  guard,
  commit,
  audit,
  type AdministrationContext,
} from "./transaction";

type Project = {
  id: string;
  name: string;
  description: string;
  lead_operator_id: string;
  start_date: string | null;
  target_date: string | null;
  color: string | null;
  icon: string | null;
  priority: string;
  lifecycle: string;
  archived_at: string | null;
};
function leadGuard(ctx: AdministrationContext, id: string) {
  return guard(
    ctx.db,
    "EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL)",
    id,
    ctx.workspace,
  );
}
export async function createProject(
  db: D1Database,
  actor: string,
  input: z.infer<typeof projectCreateSchema>,
) {
  const ctx = await administrationContext(db, actor),
    id = createUlid(new Date(ctx.at));
  validateProjectDates(input.startDate, input.targetDate);
  await commit(ctx, [
    leadGuard(ctx, input.leadOperatorId),
    ctx.db
      .prepare(
        `INSERT INTO projects(id,workspace_id,name,description,lead_operator_id,start_date,target_date,color,icon,priority,lifecycle,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'planned',?,?)`,
      )
      .bind(
        id,
        ctx.workspace,
        input.name,
        input.description,
        input.leadOperatorId,
        input.startDate,
        input.targetDate,
        input.color,
        input.icon,
        input.priority,
        ctx.at,
        ctx.at,
      ),
    ...projectLabelWrites(ctx, id, [...input.labelIds].sort()),
    activity(ctx, id, "project.created", null, {
      ...input,
      lifecycle: "planned",
    }),
  ]);
  return id;
}
export async function updateProject(
  db: D1Database,
  actor: string,
  id: string,
  input: z.infer<typeof projectUpdateSchema>,
) {
  const ctx = await administrationContext(db, actor),
    old = await ownedRow<Project>(ctx, "projects", id);
  const oldLabels = await readProjectLabelIds(ctx, id);
  const previous = {
    name: old.name,
    description: old.description,
    leadOperatorId: old.lead_operator_id,
    startDate: old.start_date,
    targetDate: old.target_date,
    color: old.color,
    icon: old.icon,
    priority: old.priority,
    labelIds: oldLabels,
    lifecycle: old.lifecycle,
    archivedAt: old.archived_at,
  };
  const next = {
    name: input.name ?? old.name,
    description: input.description ?? old.description,
    leadOperatorId: input.leadOperatorId ?? old.lead_operator_id,
    startDate: input.startDate === undefined ? old.start_date : input.startDate,
    color: input.color === undefined ? old.color : input.color,
    icon: input.icon === undefined ? old.icon : input.icon,
    priority: input.priority ?? old.priority,
    labelIds: input.labelIds === undefined ? oldLabels : [...input.labelIds].sort(),
    targetDate:
      input.targetDate === undefined ? old.target_date : input.targetDate,
    lifecycle: input.lifecycle ?? old.lifecycle,
    archivedAt:
      input.archived === undefined
        ? old.archived_at
        : input.archived
          ? (old.archived_at ?? ctx.at)
          : null,
  };
  validateProjectDates(next.startDate, next.targetDate);
  if (!old.archived_at && !["completed", "canceled"].includes(old.lifecycle)
    && (next.archivedAt || ["completed", "canceled"].includes(next.lifecycle)))
    await captureDailyReports({ DB: db }, new Date(ctx.at), ctx.workspace);
  await commit(ctx, [
    guard(
      ctx.db,
      "EXISTS(SELECT 1 FROM projects WHERE id=? AND workspace_id=? AND name=? AND description=? AND lead_operator_id=? AND target_date IS ? AND start_date IS ? AND color IS ? AND icon IS ? AND priority=? AND lifecycle=? AND archived_at IS ?)",
      id,
      ctx.workspace,
      old.name,
      old.description,
      old.lead_operator_id,
      old.target_date,
      old.start_date,
      old.color,
      old.icon,
      old.priority,
      old.lifecycle,
      old.archived_at,
    ),
    guard(ctx.db, "(SELECT json_group_array(label_id) FROM (SELECT label_id FROM project_labels WHERE project_id=? ORDER BY label_id))=?", id, JSON.stringify(oldLabels)),
    leadGuard(ctx, next.leadOperatorId),
    ctx.db
      .prepare(
        "UPDATE projects SET name=?,description=?,lead_operator_id=?,target_date=?,start_date=?,color=?,icon=?,priority=?,lifecycle=?,archived_at=?,updated_at=? WHERE id=?",
      )
      .bind(
        next.name,
        next.description,
        next.leadOperatorId,
        next.targetDate,
        next.startDate,
        next.color,
        next.icon,
        next.priority,
        next.lifecycle,
        next.archivedAt,
        ctx.at,
        id,
      ),
    ...(input.labelIds === undefined ? [] : projectLabelWrites(ctx, id, next.labelIds)),
    ...projectFieldActivity(ctx, id, previous, next),
    ...(['name','description','leadOperatorId','lifecycle','archivedAt'].some(key => previous[key as keyof typeof previous] !== next[key as keyof typeof next]) ? [activity(ctx,id,"project.updated",previous,next)] : []),
  ]);
}

export async function removeProject(db: D1Database, actor: string, id: string) {
  const ctx = await administrationContext(db, actor),
    old = await ownedRow<Project>(ctx, "projects", id);
  await commit(ctx, [
    guard(
      ctx.db,
      "EXISTS(SELECT 1 FROM projects WHERE id=? AND workspace_id=? AND name=? AND description=? AND lead_operator_id=? AND target_date IS ? AND start_date IS ? AND color IS ? AND icon IS ? AND priority=? AND lifecycle=? AND archived_at IS ?)",
      id,
      ctx.workspace,
      old.name,
      old.description,
      old.lead_operator_id,
      old.target_date,
      old.start_date,
      old.color,
      old.icon,
      old.priority,
      old.lifecycle,
      old.archived_at,
    ),
    ctx.db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
         SELECT substr(?,1,10)||upper(hex(randomblob(8))),id,?,'project.removed',json_object('projectId',project_id,'milestoneId',milestone_id),json_object('projectId',NULL,'milestoneId',NULL),?,?
         FROM issues WHERE project_id=?`,
      )
      .bind(createUlid(new Date(ctx.at)), actor, ctx.at, ctx.at, id),
    ctx.db
      .prepare("UPDATE issues SET project_id=NULL,milestone_id=NULL,version=version+1,updated_at=? WHERE project_id=?")
      .bind(ctx.at, id),
    ctx.db.prepare("DELETE FROM project_activity WHERE project_id=?").bind(id),
    ctx.db.prepare("DELETE FROM projects WHERE id=?").bind(id),
    ...audit(ctx, "project.removed", id, old.name, old, null),
  ]);
}
