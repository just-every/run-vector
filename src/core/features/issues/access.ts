export class IssueAccessError extends Error {
  constructor(
    readonly code: "unauthenticated" | "not_found",
    message: string,
    readonly status: 401 | 404,
  ) {
    super(message);
  }
}

/** Recheck this guard after asynchronous projection before exposing its DTO. */
export async function requireIssueAccess(
  binding: D1Database,
  identifier: string,
  actor: string,
) {
  const row = await issueAccessStatement(binding, identifier, actor).first<IssueAccessRow>();
  return issueAccessProjection(row);
}

export type IssueAccessRow = { removed_at: string | null; id: string | null; identifier: string; version: number };

export function issueAccessStatement(binding: D1Database, identifier: string, actor: string) {
  return binding
    .prepare(
      `SELECT actor.removed_at,i.id,i.identifier,i.version
       FROM operators actor LEFT JOIN issues i ON i.identifier=?
         AND EXISTS(SELECT 1 FROM teams t WHERE t.id=i.team_id AND t.workspace_id=actor.workspace_id)
       WHERE actor.id=?`,
    )
    .bind(identifier, actor);
}

export function issueAccessProjection(row: IssueAccessRow | null | undefined) {
  if (!row || row.removed_at !== null)
    throw new IssueAccessError('unauthenticated', 'An active native operator is required.', 401);
  if (!row.id) {
    throw new IssueAccessError("not_found", "Issue is unavailable.", 404);
  }
  return { id: row.id, identifier: row.identifier, version: row.version };
}
