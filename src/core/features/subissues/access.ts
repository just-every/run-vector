import type { Context } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { requireOperator } from "../auth/service";
import { nativeSessionAdmission } from "../auth/projection-admission";
import { IssueAccessError } from "../issues/access";
export async function requireTeamProjection(
  c: Context<AppEnvironment>,
  teamId: string,
) {
  const actor = await requireOperator(c.env, c.req.raw);
  if (!actor || actor.id !== c.get("operatorId"))
    throw new IssueAccessError(
      "unauthenticated",
      "Sign in again to continue.",
      401,
    );
  const session = nativeSessionAdmission(actor.fence);
  const row = await c.env.DB.prepare(
    `SELECT actor.removed_at,t.id,${session.sql} session_admitted FROM operators actor LEFT JOIN teams t ON t.id=? AND t.workspace_id=actor.workspace_id WHERE actor.id=?`,
  )
    .bind(...session.values, teamId, actor.id)
    .first<{
      removed_at: string | null;
      id: string | null;
      session_admitted: number;
    }>();
  if (!row || row.removed_at !== null || !row.session_admitted)
    throw new IssueAccessError(
      "unauthenticated",
      "An active native operator is required.",
      401,
    );
  if (!row.id)
    throw new IssueAccessError("not_found", "Team is unavailable.", 404);
}
