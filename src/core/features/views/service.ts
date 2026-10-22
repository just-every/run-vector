import { audit } from '../administration/transaction';
import { requireGuestViewScope } from './guest-scope';
import type { z } from "zod";
import seed from "../../../../seed.json";
import { createUlid } from "../../shared/ids";
import { browseActor } from "../issues/browse-access";
import {
  issueListQuerySchema,
  type IssueListQuery,
} from "../issues/list-schema";
import { createViewSchema, updateViewSchema, type SavedView } from "./schema";
import { ViewError, viewContext, writeViewState } from "./repository";

type ViewRow = {
  id: string;
  name: string;
  owner_operator_id: string;
  is_shared: number;
  layout: "list" | "board";
  filters_json: string;
  sort: string;
  grouping: string;
};
function viewDto(row: ViewRow): SavedView {
  return {
    id: row.id,
    name: row.name,
    ownerOperatorId: row.owner_operator_id,
    isShared: row.is_shared === 1,
    layout: row.layout,
    query: issueListQuerySchema.parse({
      ...JSON.parse(row.filters_json),
      sort: row.sort,
      grouping: row.grouping,
      offset: 0,
    }),
  };
}
function filters(query: IssueListQuery) {
  const {
    sort: _sort,
    grouping: _grouping,
    offset: _offset,
    revision: _revision,
    ...filter
  } = query;
  return JSON.stringify(filter);
}
async function requireVisibleViews(
  db: D1Database,
  actor: string,
  workspace: string,
  ids: string[],
) {
  const visible = await db
    .prepare(
      `SELECT count(*) n FROM saved_views
    WHERE id IN (SELECT value FROM json_each(?)) AND workspace_id=?
    AND (owner_operator_id=? OR is_shared=1)`,
    )
    .bind(JSON.stringify(ids), workspace, actor)
    .first<number>("n");
  await browseActor(db, actor, workspace);
  if (visible !== ids.length)
    throw new ViewError("not_found", "A view is no longer available.", 404);
}
export async function listViews(db: D1Database, actor: string) {
  const access = await browseActor(db, actor);
  const rows = await db
    .prepare(
      "SELECT * FROM saved_views WHERE workspace_id=? AND (owner_operator_id=? OR is_shared=1) ORDER BY name,id",
    )
    .bind(access.workspace_id, actor)
    .all<ViewRow>();
  await requireVisibleViews(
    db,
    actor,
    access.workspace_id,
    rows.results.map((row) => row.id),
  );
  return { views: rows.results.map(viewDto) };
}
export async function getView(db: D1Database, actor: string, id: string) {
  const access = await browseActor(db, actor);
  const row = await db
    .prepare(
      "SELECT * FROM saved_views WHERE id=? AND workspace_id=? AND (owner_operator_id=? OR is_shared=1)",
    )
    .bind(id, access.workspace_id, actor)
    .first<ViewRow>();
  await browseActor(db, actor, access.workspace_id);
  if (!row) throw new ViewError("not_found", "The view is unavailable.", 404);
  await requireVisibleViews(db, actor, access.workspace_id, [id]);
  return viewDto(row);
}
export async function createView(
  db: D1Database,
  actor: string,
  input: z.output<typeof createViewSchema>,
  sourceId?: string,
) {
  const ctx = await viewContext(db, actor),
    id = createUlid(new Date(ctx.at));
  await requireGuestViewScope(ctx.db,actor,input.query);
  const insert = ctx.db
    .prepare(
      `INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,is_shared,filters_json,sort,grouping,layout,created_at,updated_at)
 SELECT ?,?,?,?,'issues',?,?,?,?,?,?,? WHERE (SELECT count(*) FROM saved_views WHERE owner_operator_id=?)<?
 AND (? IS NULL OR EXISTS(SELECT 1 FROM saved_views source WHERE source.id=? AND source.workspace_id=? AND (source.owner_operator_id=? OR source.is_shared=1)))`,
    )
    .bind(
      id,
      ctx.workspace,
      actor,
      input.name,
      Number(input.isShared),
      filters(input.query),
      input.query.sort,
      input.query.grouping,
      input.layout,
      ctx.at,
      ctx.at,
      actor,
      seed.limits.savedViewsPerOperator,
      sourceId ?? null,
      sourceId ?? null,
      ctx.workspace,
      actor,
    );
  // INSERT's predicate and the insertion are one statement, serializing concurrent creates.
  await writeViewState(ctx, [insert]);
  const exists = await ctx.db
    .prepare("SELECT 1 FROM saved_views WHERE id=?")
    .bind(id)
    .first();
  if (!exists && sourceId) await getView(db, actor, sourceId);
  if (!exists)
    throw new ViewError(
      "view_limit",
      `You can save up to ${seed.limits.savedViewsPerOperator} views.`,
      409,
    );
  return getView(db, actor, id);
}
export async function updateView(
  db: D1Database,
  actor: string,
  id: string,
  input: z.output<typeof updateViewSchema>,
) {
  const ctx = await viewContext(db, actor),
    old = await getView(db, actor, id);
  if (old.ownerOperatorId !== actor)
    throw new ViewError(
      "forbidden",
      "Only the owner can change this shared view.",
      403,
    );
  if (input.query) await requireGuestViewScope(ctx.db,actor,input.query);
  const assignments: string[] = [],
    values: (string | number)[] = [];
  if (input.name !== undefined) {
    assignments.push("name=?");
    values.push(input.name);
  }
  if (input.isShared !== undefined) {
    assignments.push("is_shared=?");
    values.push(Number(input.isShared));
  }
  if (input.layout !== undefined) {
    assignments.push("layout=?");
    values.push(input.layout);
  }
  if (input.query !== undefined) {
    assignments.push("filters_json=?", "sort=?", "grouping=?");
    values.push(filters(input.query), input.query.sort, input.query.grouping);
  }
  await writeViewState(ctx, [
    ctx.db
      .prepare(
        `UPDATE saved_views SET ${assignments.join(",")},updated_at=? WHERE id=? AND owner_operator_id=? AND workspace_id=?`,
      )
      .bind(...values, ctx.at, id, actor, ctx.workspace),
  ]);
  return getView(db, actor, id);
}
export async function deleteView(db: D1Database, actor: string, id: string) {
  const ctx = await viewContext(db, actor),
    old = await getView(db, actor, id);
  if (old.ownerOperatorId !== actor)
    throw new ViewError(
      "forbidden",
      "Only the owner can delete this shared view.",
      403,
    );
  await writeViewState(ctx, [
    ctx.db
      .prepare(
        "DELETE FROM saved_views WHERE id=? AND owner_operator_id=? AND workspace_id=?",
      )
      .bind(id, actor, ctx.workspace),
    ...audit(ctx, "view.deleted", id, id, null, null),
  ]);
  return { deleted: true };
}
export async function duplicateView(
  db: D1Database,
  actor: string,
  id: string,
  name: string,
) {
  const source = await getView(db, actor, id);
  return createView(
    db,
    actor,
    {
      name,
      isShared: false,
      layout: source.layout,
      query: source.query,
    },
    id,
  );
}
