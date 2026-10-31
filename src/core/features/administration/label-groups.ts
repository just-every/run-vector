import { z } from "zod";
import { createUlid } from "../../shared/ids";
import { labelGroupSchema } from "./schema";
import { administrationContext, ownedRow, guard, commit, audit } from "./transaction";

const manager = "EXISTS(SELECT 1 FROM operators WHERE id=? AND role IN ('owner','admin') AND removed_at IS NULL)";
type Group = { id: string; name: string };

/** Labels are placed in a group through the label update door; a group has a
 * stable id, so renaming it never changes which labels belong to it. */
export async function createLabelGroup(db: D1Database, actor: string, input: z.infer<typeof labelGroupSchema>) {
  const ctx = await administrationContext(db, actor), id = createUlid(new Date(ctx.at));
  await commit(ctx, [
    guard(ctx.db, manager, actor),
    ctx.db.prepare("INSERT INTO label_groups(id,workspace_id,name,created_at,updated_at) VALUES(?,?,?,?,?)").bind(id, ctx.workspace, input.name, ctx.at, ctx.at),
    ...audit(ctx, "label_group.created", id, input.name, null, input),
  ]);
  return id;
}
export async function renameLabelGroup(db: D1Database, actor: string, id: string, input: z.infer<typeof labelGroupSchema>) {
  const ctx = await administrationContext(db, actor), old = await ownedRow<Group>(ctx, "label_groups", id);
  await commit(ctx, [
    guard(ctx.db, manager, actor),
    guard(ctx.db, "EXISTS(SELECT 1 FROM label_groups WHERE id=? AND workspace_id=? AND name=?)", id, ctx.workspace, old.name),
    ctx.db.prepare("UPDATE label_groups SET name=?,updated_at=? WHERE id=?").bind(input.name, ctx.at, id),
    ...audit(ctx, "label_group.renamed", id, input.name, { name: old.name }, { name: input.name }),
  ]);
}
/** Deleting a group frees its labels; no issue or label is removed. */
export async function removeLabelGroup(db: D1Database, actor: string, id: string) {
  const ctx = await administrationContext(db, actor), old = await ownedRow<Group>(ctx, "label_groups", id);
  await commit(ctx, [
    guard(ctx.db, manager, actor),
    guard(ctx.db, "EXISTS(SELECT 1 FROM label_groups WHERE id=? AND workspace_id=? AND name=?)", id, ctx.workspace, old.name),
    ctx.db.prepare("UPDATE labels SET group_id=NULL,updated_at=? WHERE group_id=?").bind(ctx.at, id),
    ctx.db.prepare("DELETE FROM label_groups WHERE id=?").bind(id),
    ...audit(ctx, "label_group.removed", id, old.name, { name: old.name }, null),
  ]);
}
