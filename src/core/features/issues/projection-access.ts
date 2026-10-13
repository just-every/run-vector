import type { Context } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { requireOperator } from "../auth/service";
import { nativeSessionAdmission } from "../auth/projection-admission";
import { IssueAccessError } from "./access";

/** Reauthorize the native session and current issue membership after projection. */
export async function requireIssueProjection(
  context: Context<AppEnvironment>,
  identifier: string,
) {
  const operator = await requireOperator(context.env, context.req.raw);
  if (!operator || operator.id !== context.get("operatorId"))
    throw new IssueAccessError(
      "unauthenticated",
      "Sign in again to continue.",
      401,
    );
  // Session validity and current membership share the last SQL snapshot. Native
  // sign-out between requireOperator's awaits and this statement must deny too.
  const session = nativeSessionAdmission(operator.fence);
  const admission = await context.env.DB.prepare(
    `SELECT actor.removed_at,i.id,i.identifier,i.version,
      ${session.sql} AS session_admitted
     FROM operators actor LEFT JOIN issues i ON i.identifier=?
       AND EXISTS(SELECT 1 FROM teams t WHERE t.id=i.team_id AND t.workspace_id=actor.workspace_id)
     WHERE actor.id=?`,
  )
    .bind(
      ...session.values,
      identifier,
      operator.id,
    )
    .first<{
      removed_at: string | null;
      id: string | null;
      identifier: string;
      version: number;
      session_admitted: number;
    }>();
  if (
    !admission ||
    admission.removed_at !== null ||
    !admission.session_admitted
  )
    throw new IssueAccessError(
      "unauthenticated",
      "An active native operator is required.",
      401,
    );
  if (!admission.id)
    throw new IssueAccessError("not_found", "Issue is unavailable.", 404);
  return {
    id: admission.id,
    identifier: admission.identifier,
    version: admission.version,
  };
}
