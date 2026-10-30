import { parentGraphSql, parentIdsSql, parentRulesSql, parentSnapshotSql, prepareParentState } from "./parent-state";
import { isMutationAccessError } from "../auth/mutation-database";
import { IssueAccessError } from "../issues/access";
import { recordCommittedUndo, undoSessionHash } from "./context";
import { fieldSchema, issueSnapshotSchema, undoActionSchema, type UndoAction, type UndoFailure } from "./schema";
import { duplicateGraphSql, identityFields, issueSnapshotSql, memberCte, type SnapshotField } from "./snapshot";

export class UndoCaptureConflict extends Error {
  readonly failures: UndoFailure[];
  constructor(identifiers: string[]) {
    super("The issue or its duplicate relations changed while the action was prepared. Nothing was changed.");
    this.failures = identifiers.map((identifier) => ({ identifier, reasons: [this.message] }));
  }
}
type Capture = {
  actionId: string; workspaceId: string; sessionHash: string; kind: UndoAction["kind"];
  fields: SnapshotField[]; ids: string; sources: string; cascade: boolean; before: string; graph: string; identifiers: string[];
  parents?: Awaited<ReturnType<typeof prepareParentState>>;
};
export async function prepareUndoCapture(db: D1Database, actor: string, input: {
  actionId: string | null; identifiers: string[]; fields: string[]; kind: UndoAction["kind"]; cascade?: boolean; parentId?: string | null;
}): Promise<Capture | null> {
  const sessionHash = await undoSessionHash(db);
  if (!sessionHash || !input.actionId || !input.identifiers.length) return null;
  const workspace = await db.prepare("SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL")
    .bind(actor).first<string>("workspace_id");
  if (!workspace) throw new IssueAccessError("unauthenticated", "Sign in again.", 401);
  const rows = (await db.prepare(`WITH selected AS (
      SELECT id FROM issues WHERE identifier IN(SELECT value FROM json_each(?))
    ) SELECT i.id,i.identifier,t.workspace_id FROM issues i JOIN teams t ON t.id=i.team_id
    WHERE i.id IN(SELECT id FROM selected) ${input.cascade ? "OR i.id IN(SELECT issue_id FROM issue_duplicates WHERE canonical_issue_id IN(SELECT id FROM selected))" : ""}
    ORDER BY i.id`).bind(JSON.stringify(input.identifiers)).all<{ id: string; identifier: string; workspace_id: string }>()).results;
  if (rows.some((row) => row.workspace_id !== workspace) || input.identifiers.some((id) => !rows.some((row) => row.identifier === id)))
    throw new IssueAccessError("not_found", "An issue is unavailable.", 404);
  // Keep the pair in new snapshots even when only one side changes. Older
  // actions retain their original fields and remain readable without a milestone.
  const projectFields = input.fields.some(field => field === "projectId" || field === "milestoneId") ? ["projectId", "milestoneId"] : [];
  const fields = fieldSchema.array().parse([...new Set([...identityFields, ...input.fields, ...projectFields])]);
  const ids = JSON.stringify(rows.map((row) => row.id));
  const snapshot = await db.prepare(`WITH ${memberCte} SELECT ${issueSnapshotSql(fields)} snapshot,
    ${input.kind === "duplicate" ? duplicateGraphSql : "'[]'"} graph`).bind(ids).first<{ snapshot: string; graph: string }>();
  if (!snapshot || issueSnapshotSchema.array().parse(JSON.parse(snapshot.snapshot)).length !== rows.length)
    throw new IssueAccessError("not_found", "An issue is unavailable.", 404);
  const parents = input.kind === "parent" ? await prepareParentState(db, rows[0].id, input.parentId ?? null) : undefined;
  if (parents && parents.ids.length !== parents.before.length)
    throw new IssueAccessError("not_found", "An issue is unavailable.", 404);
  return { parents, actionId: input.actionId, workspaceId: workspace, sessionHash, kind: input.kind, fields, ids,
    sources: JSON.stringify(rows.filter((row) => input.identifiers.includes(row.identifier)).map((row) => row.id)), cascade: Boolean(input.cascade),
    before: snapshot.snapshot, graph: snapshot.graph, identifiers: rows.map((row) => row.identifier) };
}
function captureAdmission(db: D1Database, actor: string, capture: Capture) {
  return db.prepare(admissionSql(capture)).bind(...admissionValues(actor, capture));
}

/** Extra statements retain the original caller's result indexes. The preimage,
 * post-versions, complete membership and deadline belong to this transaction. */
export async function commitUndoable(db: D1Database, actor: string, capture: Capture | null, writes: D1PreparedStatement[], postVersions: { identifier: string; version: number }[] = []) {
  if (!capture) return db.batch(writes);
  const snapshot = issueSnapshotSql(capture.fields);
  const admission = captureAdmission(db, actor, capture);
  const guard = db.prepare(`SELECT CASE WHEN admitted THEN 1 ELSE json('undo capture changed') END FROM (${admissionSql(capture)})`)
    .bind(...admissionValues(actor, capture));
  const parentIds = parentIdsSql(capture.parents?.ids ?? []);
  // Readable parent subjects still feed the native role/team admission. Keep
  // the complete automation preimage opaque to scoped history filtering.
  // publicActivityValue strips the entire undo member from every projection.
  const retained = capture.parents ? `substr(json_object('ids',json(${parentIds}),
    'visibleIds',json(${parentIdsSql(capture.parents.visibleIds)}),'before',json(?),
    'after',json(${parentSnapshotSql(parentIds)}),'graph',substr(${parentGraphSql(parentIds)},1),'rules',substr(${parentRulesSql(parentIds)},1)),1)` : "NULL";
  const visibleIds = parentIdsSql(capture.parents?.visibleIds ?? []);
  const parents = capture.parents ? `json_object('ids',json(${visibleIds}),
    'before',json((SELECT json_group_array(json(value)) FROM json_each(?) WHERE json_extract(value,'$.id') IN(SELECT value FROM json_each(${visibleIds})))),
    'after',json(${parentSnapshotSql(visibleIds)}),'retained',${retained})` : "NULL";
  const metadata = db.prepare(`WITH ${memberCte}, pre AS (SELECT value body FROM json_each(?)),
      post AS (SELECT value body FROM json_each(${snapshot}))
    UPDATE issue_activity SET next_value_json=json_set(COALESCE(next_value_json,'{}'),'$.undo',json_object(
      'actionId',?,'workspaceId',?,'sessionHash',?,'kind',?,'fields',json(?),
      'before',json(?),'after',json(${snapshot}),'postVersions',json(?),'graph',json(${capture.kind === "duplicate" ? duplicateGraphSql : "'[]'"}),
      'parents',${parents},'expiresAt',strftime('%Y-%m-%dT%H:%M:%fZ','now','+10 seconds')))
    WHERE id=? AND actor_operator_id=? AND EXISTS(
      SELECT 1 FROM pre JOIN post ON json_extract(pre.body,'$.id')=json_extract(post.body,'$.id')
      WHERE json_remove(pre.body,'$.version','$.canonicalCreatedAt')<>json_remove(post.body,'$.version','$.canonicalCreatedAt'))`)
    .bind(capture.ids, capture.before, capture.actionId, capture.workspaceId, capture.sessionHash, capture.kind,
      JSON.stringify(capture.fields), capture.before, JSON.stringify(postVersions),
      ...(capture.parents ? [JSON.stringify(capture.parents.before), JSON.stringify(capture.parents.before)] : []), capture.actionId, actor);
  const postGuard = db.prepare(`WITH ${memberCte}, pre AS (SELECT value body FROM json_each(?))
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM issue_activity WHERE id=?) OR NOT EXISTS(
      SELECT 1 FROM pre WHERE NOT EXISTS(SELECT 1 FROM issues i WHERE i.id=json_extract(pre.body,'$.id')
        AND i.version=COALESCE((SELECT json_extract(value,'$.version') FROM json_each(?) WHERE json_extract(value,'$.identifier')=i.identifier),json_extract(pre.body,'$.version')+1))) THEN 1 ELSE json('undo post-version mismatch') END`)
    .bind(capture.ids, capture.before, capture.actionId, JSON.stringify(postVersions));
  let results: D1Result[];
  try {
    results = await db.batch([guard, ...writes, postGuard, metadata,
      db.prepare("SELECT json_extract(next_value_json,'$.undo') action FROM issue_activity WHERE id=? AND actor_operator_id=?")
        .bind(capture.actionId, actor)]);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    if (!(await admission.first<number>("admitted"))) throw new UndoCaptureConflict(capture.identifiers);
    throw error;
  }
  const row = results.at(-1)!.results[0] as { action?: string | null } | undefined;
  if (row?.action) {
    const action = undoActionSchema.parse(JSON.parse(row.action));
    recordCommittedUndo(db, { actionId: action.actionId, expiresAt: Date.parse(action.expiresAt),
      identifiers: action.after.map((issue) => issue.identifier) });
  }
  return results.slice(1, 1 + writes.length);
}
function admissionValues(actor: string, capture: Capture) {
  return [capture.ids, capture.sources, actor, capture.workspaceId, capture.before, capture.graph,
    ...(capture.parents ? [JSON.stringify(capture.parents.before), capture.parents.graph, capture.parents.rules] : [])];
}
function admissionSql(capture: Capture) {
  const incoming = capture.cascade ? "OR EXISTS(SELECT 1 FROM issue_duplicates d WHERE d.issue_id=i.id AND d.canonical_issue_id IN(SELECT id FROM undo_sources))" : "";
  return `WITH ${memberCte}, undo_sources AS (SELECT value id FROM json_each(?)) SELECT
    EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL)
    AND ${issueSnapshotSql(capture.fields)}=?
    AND ${capture.kind === "duplicate" ? duplicateGraphSql : "'[]'"}=?
    ${capture.parents ? `AND ${parentSnapshotSql(parentIdsSql(capture.parents.ids))}=?
      AND ${parentGraphSql(parentIdsSql(capture.parents.ids))}=? AND ${parentRulesSql(parentIdsSql(capture.parents.ids))}=?
      AND (SELECT count(*) FROM issues WHERE id IN(SELECT value FROM json_each(${parentIdsSql(capture.parents.visibleIds)})))=${capture.parents.visibleIds.length}` : ""}
    AND NOT EXISTS(SELECT 1 FROM issues i WHERE (i.id IN(SELECT id FROM undo_sources) ${incoming}) AND i.id NOT IN(SELECT id FROM undo_members))
    AND NOT EXISTS(SELECT 1 FROM undo_members m WHERE m.id NOT IN(SELECT id FROM undo_sources)
      ${capture.cascade ? "AND NOT EXISTS(SELECT 1 FROM issue_duplicates d WHERE d.issue_id=m.id AND d.canonical_issue_id IN(SELECT id FROM undo_sources))" : ""}) admitted`;
}
