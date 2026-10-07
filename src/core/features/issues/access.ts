export class IssueAccessError extends Error {
  constructor(
    readonly code: "unauthenticated" | "not_found",
    message: string,
    readonly status: 401 | 404,
  ) {
    super(message);
  }
}

async function requireActiveActor(binding: D1Database, actor: string) {
  const operator = await binding
    .prepare("SELECT removed_at FROM operators WHERE id=?")
    .bind(actor)
    .first<{ removed_at: string | null }>();
  if (!operator || operator.removed_at !== null)
    throw new IssueAccessError(
      "unauthenticated",
      "An active native operator is required.",
      401,
    );
}

/** Recheck this guard after asynchronous projection before exposing its DTO. */
export async function requireIssueAccess(
  binding: D1Database,
  identifier: string,
  actor: string,
) {
  await requireActiveActor(binding, actor);
  const issue = await binding
    .prepare(
      `SELECT i.id,i.identifier,i.version FROM issues i JOIN teams t ON t.id=i.team_id
     JOIN operators actor ON actor.workspace_id=t.workspace_id AND actor.id=? AND actor.removed_at IS NULL
     WHERE i.identifier=?`,
    )
    .bind(actor, identifier)
    .first<{ id: string; identifier: string; version: number }>();
  if (!issue) {
    await requireActiveActor(binding, actor);
    throw new IssueAccessError("not_found", "Issue is unavailable.", 404);
  }
  return issue;
}
