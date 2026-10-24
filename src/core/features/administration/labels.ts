import { z } from "zod";
import { createUlid } from "../../shared/ids";
import { labelCreateSchema, labelUpdateSchema } from "./schema";
import {
  administrationContext,
  ownedRow,
  guard,
  commit,
  audit,
  SettingsError,
} from "./transaction";

type Label = { id: string; name: string; color: string; projects_enabled: number };
export async function createLabel(
  db: D1Database,
  actor: string,
  input: z.infer<typeof labelCreateSchema>,
) {
  const ctx = await administrationContext(db, actor),
    id = createUlid(new Date(ctx.at));
  const allowed = `EXISTS(SELECT 1 FROM operators o JOIN workspace_settings w ON w.id=o.workspace_id
    WHERE o.id=? AND o.removed_at IS NULL AND (o.role IN ('owner','admin') OR o.role='member' AND w.member_label_creation=1))`;
  if (!await ctx.db.prepare(`SELECT 1 WHERE ${allowed}`).bind(actor).first())
    throw new SettingsError("label_creation_forbidden", "Only Owners and Admins may create labels with the current workspace permission.", 403);
  await commit(ctx, [
    guard(ctx.db, allowed, actor),
    ctx.db
      .prepare(
        "INSERT INTO labels(id,workspace_id,name,color,projects_enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(id, ctx.workspace, input.name, input.color, Number(input.projectsEnabled), ctx.at, ctx.at),
    ...audit(ctx, "label.created", id, input.name, null, input),
  ]);
  return id;
}
export async function setLabelCreation(db: D1Database, actor: string, membersMayCreate: boolean) {
  const ctx = await administrationContext(db, actor);
  const previous = await ctx.db.prepare("SELECT member_label_creation AS value FROM workspace_settings WHERE id=?").bind(ctx.workspace).first<number>("value");
  if (previous === Number(membersMayCreate)) return;
  await commit(ctx, [
    guard(ctx.db, "EXISTS(SELECT 1 FROM operators WHERE id=? AND role IN ('owner','admin') AND removed_at IS NULL)", actor),
    guard(ctx.db, "EXISTS(SELECT 1 FROM workspace_settings WHERE id=? AND member_label_creation=?)", ctx.workspace, previous!),
    ctx.db.prepare("UPDATE workspace_settings SET member_label_creation=?,updated_at=? WHERE id=?").bind(Number(membersMayCreate),ctx.at,ctx.workspace),
    ...audit(ctx, "workspace.label_creation_changed", ctx.workspace, "Label creation", {membersMayCreate: previous === 1}, {membersMayCreate}),
  ]);
}
export async function updateLabel(
  db: D1Database,
  actor: string,
  id: string,
  input: z.infer<typeof labelUpdateSchema>,
) {
  const ctx = await administrationContext(db, actor),
    old = await ownedRow<Label>(ctx, "labels", id),
    next = { name: input.name ?? old.name, color: input.color ?? old.color, projectsEnabled: input.projectsEnabled ?? Boolean(old.projects_enabled) };
  await commit(ctx, [
    guard(
      ctx.db,
      "EXISTS(SELECT 1 FROM labels WHERE id=? AND workspace_id=? AND name=? AND color=? AND projects_enabled=?)",
      id,
      ctx.workspace,
      old.name,
      old.color,
      old.projects_enabled,
    ),
    ctx.db
      .prepare("UPDATE labels SET name=?,color=?,projects_enabled=?,updated_at=? WHERE id=?")
      .bind(next.name, next.color, Number(next.projectsEnabled), ctx.at, id),
    ...audit(
      ctx,
      "label.updated",
      id,
      next.name,
      { name: old.name, color: old.color, projectsEnabled: Boolean(old.projects_enabled) },
      next,
    ),
  ]);
}
/** Native label predicates live at the top level. Unknown extension predicates,
 * including objects that happen to contain the same string, remain untouched. */
export function removeLabelFilter(value: unknown, id: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SettingsError(
      "invalid_saved_view",
      "A saved view has invalid filters. Repair it before deleting this label.",
      409,
    );
  const next = { ...(value as Record<string, unknown>) };
  for (const key of ["labelIds", "labels"]) {
    if (key in next) {
      if (
        !Array.isArray(next[key]) ||
        !(next[key] as unknown[]).every((v) => typeof v === "string")
      )
        throw new SettingsError(
          "invalid_saved_view",
          "A saved view has invalid label filters. Repair it before deleting this label.",
          409,
        );
      next[key] = (next[key] as string[]).filter((v) => v !== id);
    }
  }
  if (next.labelId === id) delete next.labelId;
  if (next.label === id) delete next.label;
  return next;
}
export async function removeLabel(db: D1Database, actor: string, id: string) {
  const ctx = await administrationContext(db, actor),
    old = await ownedRow<Label>(ctx, "labels", id);
  const views = (
    await ctx.db
      .prepare(
        "SELECT id,filters_json FROM main.saved_views WHERE workspace_id=? ORDER BY id",
      )
      .bind(ctx.workspace)
      .all<{ id: string; filters_json: string }>()
  ).results;
  const changed: { id: string; before: string; after: string }[] = [];
  for (const view of views) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(view.filters_json);
    } catch {
      throw new SettingsError(
        "invalid_saved_view",
        "A saved view contains corrupt JSON. Repair it before deleting this label.",
        409,
      );
    }
    const cleaned = removeLabelFilter(parsed, id);
    if (JSON.stringify(cleaned) !== JSON.stringify(parsed))
      changed.push({
        id: view.id,
        before: view.filters_json,
        after: JSON.stringify(cleaned),
      });
  }
  const oldLabels = `(SELECT json_group_array(label_id) FROM (SELECT label_id FROM issue_labels WHERE issue_id=issues.id ORDER BY label_id))`;
  const nextLabels = `(SELECT json_group_array(label_id) FROM (SELECT label_id FROM issue_labels WHERE issue_id=issues.id AND label_id<>? ORDER BY label_id))`;
  await commit(ctx, [
    guard(
      ctx.db,
      "EXISTS(SELECT 1 FROM labels WHERE id=? AND workspace_id=? AND name=? AND color=? AND projects_enabled=?)",
      id,
      ctx.workspace,
      old.name,
      old.color,
      old.projects_enabled,
    ),
    guard(
      ctx.db,
      `(SELECT json_group_array(json_array(id,filters_json)) FROM (SELECT id,filters_json FROM main.saved_views WHERE workspace_id=? ORDER BY id))=?`,
      ctx.workspace,
      JSON.stringify(views.map((v) => [v.id, v.filters_json])),
    ),
    ctx.db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) SELECT lower(hex(randomblob(16))),id,?,'label.removed',json_object('labelIds',json(${oldLabels})),json_object('labelIds',json(${nextLabels})),?,? FROM issues WHERE EXISTS(SELECT 1 FROM issue_labels WHERE issue_id=issues.id AND label_id=?)`,
      )
      .bind(actor, id, ctx.at, ctx.at, id),
    ctx.db
      .prepare(
        "UPDATE issues SET version=version+1,updated_at=? WHERE EXISTS(SELECT 1 FROM issue_labels WHERE issue_id=issues.id AND label_id=?)",
      )
      .bind(ctx.at, id),
    ...changed.map((v) =>
      ctx.db
        .prepare(
          "UPDATE saved_views SET filters_json=?,updated_at=? WHERE id=?",
        )
        .bind(v.after, ctx.at, v.id),
    ),
    ctx.db.prepare(`INSERT INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT lower(hex(randomblob(16))),p.id,?,'project.labelIds_changed',
      (SELECT json_group_array(label_id) FROM (SELECT label_id FROM project_labels WHERE project_id=p.id ORDER BY label_id)),
      (SELECT json_group_array(label_id) FROM (SELECT label_id FROM project_labels WHERE project_id=p.id AND label_id<>? ORDER BY label_id)),?,?
      FROM projects p WHERE EXISTS(SELECT 1 FROM project_labels WHERE project_id=p.id AND label_id=?)`).bind(actor,id,ctx.at,ctx.at,id),
    ctx.db.prepare("UPDATE projects SET updated_at=? WHERE id IN (SELECT project_id FROM project_labels WHERE label_id=?)").bind(ctx.at,id),
    ctx.db.prepare(`UPDATE list_preferences SET filters_json=json_set(filters_json,'$.label','all'),updated_at=?
      WHERE surface='projects' AND operator_id IN (SELECT id FROM operators WHERE workspace_id=?) AND json_extract(filters_json,'$.label')=?`).bind(ctx.at,ctx.workspace,id),
    ctx.db.prepare("DELETE FROM labels WHERE id=?").bind(id),
    ...audit(
      ctx,
      "label.removed",
      id,
      old.name,
      { name: old.name, color: old.color, projectsEnabled: Boolean(old.projects_enabled) },
      null,
    ),
  ]);
}

/** Replace only native top-level label predicates, retaining extension data. */
export function mergeLabelFilter(value: unknown, source: string, destination: string) {
  removeLabelFilter(value, source); // validates exactly the same native filter shape as deletion
  const next = {...value as Record<string, unknown>};
  for (const key of ["labelIds", "labels"])
    if (Array.isArray(next[key])) next[key] = [...new Set((next[key] as string[]).map(id => id === source ? destination : id))];
  for (const key of ["labelId", "label"]) if (next[key] === source) next[key] = destination;
  return next;
}
export async function mergeLabel(db: D1Database, actor: string, source: string, destination: string) {
  if (source === destination) throw new SettingsError("invalid_label_merge", "Choose a different destination label.", 400);
  const ctx = await administrationContext(db, actor);
  const old = await ownedRow<Label>(ctx, "labels", source), target = await ownedRow<Label>(ctx, "labels", destination);
  if (!target.projects_enabled && await ctx.db.prepare("SELECT 1 FROM project_labels WHERE label_id=?").bind(source).first())
    throw new SettingsError("invalid_label_merge", "Enable the destination label for projects before merging a label used by projects.", 409);
  const views = (await ctx.db.prepare("SELECT id,filters_json FROM main.saved_views WHERE workspace_id=? ORDER BY id").bind(ctx.workspace).all<{id:string;filters_json:string}>()).results;
  const changed = views.map(view => {
    let filters: unknown;
    try { filters=JSON.parse(view.filters_json); }
    catch { throw new SettingsError("invalid_saved_view", "Repair corrupt saved-view filters before merging labels.", 409); }
    return {...view, next: JSON.stringify(mergeLabelFilter(filters,source,destination))};
  }).filter(view=>view.next!==view.filters_json);
  const previous = `(SELECT json_group_array(label_id) FROM (SELECT label_id FROM issue_labels WHERE issue_id=issues.id ORDER BY label_id))`;
  const next = `(SELECT json_group_array(label_id) FROM (SELECT DISTINCT CASE WHEN label_id=? THEN ? ELSE label_id END AS label_id FROM issue_labels WHERE issue_id=issues.id ORDER BY label_id))`;
  await commit(ctx, [
    guard(ctx.db,"EXISTS(SELECT 1 FROM labels WHERE id=? AND workspace_id=? AND name=? AND color=? AND projects_enabled=?)",source,ctx.workspace,old.name,old.color,old.projects_enabled),
    guard(ctx.db,"EXISTS(SELECT 1 FROM labels WHERE id=? AND workspace_id=? AND name=? AND color=? AND projects_enabled=?)",destination,ctx.workspace,target.name,target.color,target.projects_enabled),
    guard(ctx.db,"(SELECT json_group_array(json_array(id,filters_json)) FROM (SELECT id,filters_json FROM main.saved_views WHERE workspace_id=? ORDER BY id))=?",ctx.workspace,JSON.stringify(views.map(view=>[view.id,view.filters_json]))),
    ctx.db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT lower(hex(randomblob(16))),id,?,'label.merged',json_object('labelIds',json(${previous})),json_object('labelIds',json(${next})),?,? FROM issues
      WHERE EXISTS(SELECT 1 FROM issue_labels WHERE issue_id=issues.id AND label_id=?)`).bind(actor,source,destination,ctx.at,ctx.at,source),
    ctx.db.prepare("UPDATE issues SET version=version+1,updated_at=? WHERE id IN(SELECT issue_id FROM issue_labels WHERE label_id=?)").bind(ctx.at,source),
    ctx.db.prepare("INSERT OR IGNORE INTO issue_labels(issue_id,label_id,created_at) SELECT issue_id,?,? FROM issue_labels WHERE label_id=?").bind(destination,ctx.at,source),
    ctx.db.prepare(`INSERT INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT lower(hex(randomblob(16))),p.id,?,'project.labelIds_changed',
      (SELECT json_group_array(label_id) FROM (SELECT label_id FROM project_labels WHERE project_id=p.id ORDER BY label_id)),
      (SELECT json_group_array(label_id) FROM (SELECT DISTINCT CASE WHEN label_id=? THEN ? ELSE label_id END AS label_id FROM project_labels WHERE project_id=p.id ORDER BY label_id)),?,?
      FROM projects p WHERE EXISTS(SELECT 1 FROM project_labels WHERE project_id=p.id AND label_id=?)`).bind(actor,source,destination,ctx.at,ctx.at,source),
    ctx.db.prepare("UPDATE projects SET updated_at=? WHERE id IN(SELECT project_id FROM project_labels WHERE label_id=?)").bind(ctx.at,source),
    ctx.db.prepare("INSERT OR IGNORE INTO project_labels(project_id,label_id,created_at) SELECT project_id,?,? FROM project_labels WHERE label_id=?").bind(destination,ctx.at,source),
    ...changed.map(view=>ctx.db.prepare("UPDATE saved_views SET filters_json=?,updated_at=? WHERE id=?").bind(view.next,ctx.at,view.id)),
    ctx.db.prepare("UPDATE list_preferences SET filters_json=json_set(filters_json,'$.label',?),updated_at=? WHERE surface='projects' AND operator_id IN(SELECT id FROM operators WHERE workspace_id=?) AND json_extract(filters_json,'$.label')=?").bind(destination,ctx.at,ctx.workspace,source),
    ctx.db.prepare("DELETE FROM labels WHERE id=?").bind(source),
    ...audit(ctx,"label.merged",source,old.name,{id:source,name:old.name},{id:destination,name:target.name}),
  ]);
}
