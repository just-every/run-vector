type OrderedIssue = { id: string; identifier: string; position: number | null };
import { resolveScope, membership, visibility, type Scope } from "./access";
import { ManualOrderError, unavailable } from "./errors";
export { ManualOrderError } from "./errors";
import { mutationDatabase } from "../auth/mutation-database";
import type { ManualOrderMove, ManualOrderScope } from "./schema";

async function version(db: D1Database, scope: Scope) {
  return (
    (await db
      .prepare(
        "SELECT version FROM manual_order_scopes WHERE workspace_id=? AND scope_key=?",
      )
      .bind(scope.workspace, scope.key)
      .first<number>("version")) ?? 0
  );
}
export async function readManualOrder(
  db: D1Database,
  actor: string,
  input: ManualOrderScope,
) {
  const scope = await resolveScope(db, actor, input),
    admitted = visibility(scope, actor);
  const row = await db
    .prepare(
      `SELECT COALESCE((SELECT version FROM manual_order_scopes WHERE workspace_id=? AND scope_key=?),0) version WHERE ${admitted.sql}`,
    )
    .bind(scope.workspace, scope.key, ...admitted.values)
    .first<{ version: number }>();
  if (!row) throw unavailable();
  return row;
}

/** Null positions follow positioned entries, ordered by identifier. This is also
 * the SQL browse contract. Materialize missing positions before an actual move;
 * integer window ranks give averaging room without changing issue records. */
export async function moveManualOrder(
  source: D1Database,
  actor: string,
  input: ManualOrderMove,
) {
  const db = mutationDatabase(source, actor),
    scope = await resolveScope(db, actor, input),
    member = membership(scope),
    admitted = visibility(scope, actor);
  const [state, listing, revision] = await db.batch([
    db
      .prepare(
        "SELECT version FROM manual_order_scopes WHERE workspace_id=? AND scope_key=?",
      )
      .bind(scope.workspace, scope.key),
    db
      .prepare(
        `SELECT i.id,i.identifier,e.position FROM issues i JOIN teams t ON t.id=i.team_id
      LEFT JOIN manual_order_entries e ON e.workspace_id=? AND e.scope_key=? AND e.issue_id=i.id
      WHERE ${member.sql} ORDER BY e.position IS NULL,e.position,i.identifier`,
      )
      .bind(scope.workspace, scope.key, ...member.values),
    db.prepare("SELECT revision FROM issue_list_revision WHERE id=1"),
  ]);
  const currentVersion =
    (state.results[0] as { version: number } | undefined)?.version ?? 0;
  if (currentVersion !== input.expectedVersion)
    return { version: currentVersion, stale: true };
  const rows = listing.results as OrderedIssue[],
    subject = rows.find((row) => row.identifier === input.identifier);
  if (!subject) throw unavailable();
  const anchor = input.anchor
    ? rows.find((row) => row.identifier === input.anchor)
    : undefined;
  if (input.anchor && !anchor) throw unavailable();
  if (input.teamId) {
    const subjectTeam = await db
      .prepare("SELECT team_id FROM issues WHERE id=?")
      .bind(subject.id)
      .first<string>("team_id");
    if (subjectTeam !== input.teamId) throw unavailable();
    if (
      anchor &&
      (await db
        .prepare("SELECT team_id FROM issues WHERE id=?")
        .bind(anchor.id)
        .first<string>("team_id")) !== input.teamId
    )
      throw unavailable();
  }
  const from = rows.indexOf(subject),
    remaining = rows.filter((row) => row.id !== subject.id);
  let to =
    input.action === "top"
      ? 0
      : input.action === "up"
        ? Math.max(0, from - 1)
        : input.action === "down"
          ? Math.min(remaining.length, from + 1)
          : remaining.indexOf(anchor!) + (input.action === "after" ? 1 : 0);
  to = Math.max(0, Math.min(remaining.length, to));
  let normalize = rows.some((row) => row.position === null);
  const candidate = (normalized: boolean) => {
    const position = (row: OrderedIssue) =>
      normalized ? rows.indexOf(row) + 1 : row.position!;
    const left = remaining[to - 1],
      right = remaining[to];
    return left && right
      ? position(left) + (position(right) - position(left)) / 2
      : left
        ? position(left) + 1
        : right
          ? position(right) - 1
          : 1;
  };
  let next = candidate(normalize);
  const left = remaining[to - 1],
    right = remaining[to];
  if (
    !Number.isFinite(next) ||
    (!normalize &&
      ((left && next <= left.position!) || (right && next >= right.position!)))
  ) {
    normalize = true;
    next = candidate(true);
  }
  const baseline = (revision.results[0] as { revision: number }).revision;
  const requiredIds = [subject.id, ...(anchor ? [anchor.id] : [])];
  const writes = [
    db
      .prepare(
        `SELECT CASE WHEN ${admitted.sql}
    AND COALESCE((SELECT version FROM manual_order_scopes WHERE workspace_id=? AND scope_key=?),0)=?
    AND (SELECT revision FROM issue_list_revision WHERE id=1)=?
    AND (SELECT count(*) FROM issues i JOIN teams t ON t.id=i.team_id WHERE ${member.sql}
      AND i.id IN (SELECT value FROM json_each(?))${input.teamId ? " AND i.team_id=?" : ""})=?
    THEN 1 ELSE json('manual order changed') END`,
      )
      .bind(
        ...admitted.values,
        scope.workspace,
        scope.key,
        input.expectedVersion,
        baseline,
        ...member.values,
        JSON.stringify(requiredIds),
        ...(input.teamId ? [input.teamId] : []),
        requiredIds.length,
      ),
    db
      .prepare(
        "INSERT INTO manual_order_scopes(workspace_id,scope_key,version) VALUES(?,?,0) ON CONFLICT DO NOTHING",
      )
      .bind(scope.workspace, scope.key),
  ];
  if (normalize)
    writes.push(
      db
        .prepare(
          `INSERT INTO manual_order_entries(workspace_id,scope_key,issue_id,position)
    SELECT ?,?,id,rank FROM (SELECT i.id,row_number() OVER (ORDER BY e.position IS NULL,e.position,i.identifier) rank
      FROM issues i JOIN teams t ON t.id=i.team_id LEFT JOIN manual_order_entries e
        ON e.workspace_id=? AND e.scope_key=? AND e.issue_id=i.id WHERE ${member.sql}) WHERE 1
    ON CONFLICT(workspace_id,scope_key,issue_id) DO UPDATE SET position=excluded.position`,
        )
        .bind(
          scope.workspace,
          scope.key,
          scope.workspace,
          scope.key,
          ...member.values,
        ),
    );
  writes.push(
    db
      .prepare(
        `INSERT INTO manual_order_entries(workspace_id,scope_key,issue_id,position) VALUES(?,?,?,?)
    ON CONFLICT(workspace_id,scope_key,issue_id) DO UPDATE SET position=excluded.position`,
      )
      .bind(scope.workspace, scope.key, subject.id, next),
    db
      .prepare(
        "UPDATE vector_import_revisions SET revision=lower(hex(randomblob(32))) WHERE issue_id=?",
      )
      .bind(subject.id),
    db
      .prepare(
        "UPDATE manual_order_scopes SET version=version+1 WHERE workspace_id=? AND scope_key=?",
      )
      .bind(scope.workspace, scope.key),
  );
  try {
    await db.batch(writes);
  } catch (error) {
    if (!/malformed JSON/i.test(String(error))) throw error;
    await resolveScope(db, actor, input);
    const latest = await version(db, scope);
    if (latest !== input.expectedVersion)
      return { version: latest, stale: true };
    throw new ManualOrderError(
      "order_changed",
      "Issues changed during this move. Refresh and try again.",
      409,
    );
  }
  await resolveScope(db, actor, input);
  return { version: input.expectedVersion + 1, stale: false };
}
