import { z } from "zod";
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
  target_date: string | null;
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
function activity(
  ctx: AdministrationContext,
  id: string,
  kind: string,
  previous: unknown,
  next: unknown,
) {
  return ctx.db
    .prepare(
      "INSERT INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
    )
    .bind(
      createUlid(new Date(ctx.at)),
      id,
      ctx.actor,
      kind,
      JSON.stringify(previous),
      JSON.stringify(next),
      ctx.at,
      ctx.at,
    );
}
export async function createProject(
  db: D1Database,
  actor: string,
  input: z.infer<typeof projectCreateSchema>,
) {
  const ctx = await administrationContext(db, actor),
    id = createUlid(new Date(ctx.at));
  await commit(ctx, [
    leadGuard(ctx, input.leadOperatorId),
    ctx.db
      .prepare(
        `INSERT INTO projects(id,workspace_id,name,description,lead_operator_id,target_date,lifecycle,created_at,updated_at) VALUES(?,?,?,?,?,?,'planned',?,?)`,
      )
      .bind(
        id,
        ctx.workspace,
        input.name,
        input.description,
        input.leadOperatorId,
        input.targetDate,
        ctx.at,
        ctx.at,
      ),
    activity(ctx, id, "project.created", null, {
      ...input,
      lifecycle: "planned",
    }),
  ]);
}
export async function updateProject(
  db: D1Database,
  actor: string,
  id: string,
  input: z.infer<typeof projectUpdateSchema>,
) {
  const ctx = await administrationContext(db, actor),
    old = await ownedRow<Project>(ctx, "projects", id);
  const previous = {
    name: old.name,
    description: old.description,
    leadOperatorId: old.lead_operator_id,
    targetDate: old.target_date,
    lifecycle: old.lifecycle,
    archivedAt: old.archived_at,
  };
  const next = {
    name: input.name ?? old.name,
    description: input.description ?? old.description,
    leadOperatorId: input.leadOperatorId ?? old.lead_operator_id,
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
  await commit(ctx, [
    guard(
      ctx.db,
      "EXISTS(SELECT 1 FROM projects WHERE id=? AND workspace_id=? AND name=? AND description=? AND lead_operator_id=? AND target_date IS ? AND lifecycle=? AND archived_at IS ?)",
      id,
      ctx.workspace,
      old.name,
      old.description,
      old.lead_operator_id,
      old.target_date,
      old.lifecycle,
      old.archived_at,
    ),
    leadGuard(ctx, next.leadOperatorId),
    ctx.db
      .prepare(
        "UPDATE projects SET name=?,description=?,lead_operator_id=?,target_date=?,lifecycle=?,archived_at=?,updated_at=? WHERE id=?",
      )
      .bind(
        next.name,
        next.description,
        next.leadOperatorId,
        next.targetDate,
        next.lifecycle,
        next.archivedAt,
        ctx.at,
        id,
      ),
    activity(ctx, id, "project.updated", previous, next),
  ]);
}

export async function removeProject(db: D1Database, actor: string, id: string) {
  const ctx = await administrationContext(db, actor),
    old = await ownedRow<Project>(ctx, "projects", id);
  await commit(ctx, [
    guard(
      ctx.db,
      "EXISTS(SELECT 1 FROM projects WHERE id=? AND workspace_id=? AND name=? AND description=? AND lead_operator_id=? AND target_date IS ? AND lifecycle=? AND archived_at IS ?)",
      id,
      ctx.workspace,
      old.name,
      old.description,
      old.lead_operator_id,
      old.target_date,
      old.lifecycle,
      old.archived_at,
    ),
    ctx.db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
         SELECT lower(hex(randomblob(16))),id,?,'project.removed',json_object('projectId',project_id),json_object('projectId',NULL),?,?
         FROM issues WHERE project_id=?`,
      )
      .bind(actor, ctx.at, ctx.at, id),
    ctx.db
      .prepare("UPDATE issues SET project_id=NULL,version=version+1,updated_at=? WHERE project_id=?")
      .bind(ctx.at, id),
    ctx.db.prepare("DELETE FROM project_activity WHERE project_id=?").bind(id),
    ctx.db.prepare("DELETE FROM projects WHERE id=?").bind(id),
    ...audit(ctx, "project.removed", id, old.name, old, null),
  ]);
}
