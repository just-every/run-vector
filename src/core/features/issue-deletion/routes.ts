import { requireIssueProjection } from "../issues/projection-access";
import { getIssueDetail } from "../issues/service";
import type { Hono, Context } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { requireOperator } from "../auth/service";
import { operatorProjectionStatus } from "../auth/projection-admission";
import { IssueAccessError } from "../issues/access";
import { processDeletedIssueFiles } from "../file-removal/service";
import type { ImportActor } from "../data/import/authority";
import { deleteIssue, DeletionConflict } from "./service";
const identifierSchema = z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
const input = z
  .object({
    expectedVersion: z.number().int().positive(),
    confirmed: z.literal(true),
  })
  .strict();
async function actor(c: Context<AppEnvironment>): Promise<ImportActor> {
  const admitted = await requireOperator(c.env, c.req.raw);
  if (!admitted || admitted.id !== c.get("operatorId"))
    throw new IssueAccessError("unauthenticated", "Sign in again.", 401);
  const workspace = await c.env.DB.prepare(
    "SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL",
  )
    .bind(admitted.id)
    .first<string>("workspace_id");
  if (!workspace)
    throw new IssueAccessError("unauthenticated", "Sign in again.", 401);
  return { id: admitted.id, workspace, fence: admitted.fence };
}
async function receipt(
  c: Context<AppEnvironment>,
  owner: ImportActor,
  identifier: string,
) {
  const row = await c.env.DB.prepare(
    `SELECT d.identifier,d.requested_at,
 (SELECT count(*) FROM detached_file_removals f WHERE f.issue_id=d.issue_id) files,
 (SELECT count(*) FROM detached_file_removals f WHERE f.issue_id=d.issue_id AND f.removal_confirmed_at IS NOT NULL) removed,
 (SELECT count(*) FROM detached_file_removals f WHERE f.issue_id=d.issue_id AND f.removal_confirmed_at IS NULL AND f.cleanup_error IS NOT NULL) failed
 FROM issue_deletions d WHERE d.identifier=? AND d.workspace_id=?`,
  )
    .bind(identifier, owner.workspace)
    .first<{
      identifier: string;
      requested_at: string;
      files: number;
      removed: number;
      failed: number;
    }>();
  const current = await requireOperator(c.env, c.req.raw);
  const admission =
    current?.id === owner.id &&
    current.fence.sessionId === owner.fence.sessionId
      ? await operatorProjectionStatus(
          c.env.DB,
          owner.id,
          owner.workspace,
          owner.fence,
        )
      : 401;
  if (admission !== 200)
    throw new IssueAccessError(
      admission === 401 ? "unauthenticated" : "not_found",
      "Deletion receipt is unavailable.",
      admission,
    );
  if (!row)
    throw new IssueAccessError(
      "not_found",
      "Deletion receipt is unavailable.",
      404,
    );
  return {
    identifier: row.identifier,
    deleted: true as const,
    requestedAt: row.requested_at,
    files: row.files,
    removed: row.removed,
    cleanup:
      row.files === row.removed
        ? ("complete" as const)
        : row.failed
          ? ("failed" as const)
          : ("pending" as const),
    statusUrl: `/api/issues/${identifier}/deletion`,
  };
}
export function addIssueDeletionRoutes(app: Hono<AppEnvironment>) {
  app.delete("/issues/:identifier", async (c) => {
    const identifier = c.req.param("identifier"),
      parsed = input.safeParse(await readRequestJson(c.req.raw));
    if (!identifierSchema.safeParse(identifier).success || !parsed.success)
      return c.json({ error: "invalid_request" }, 400);
    try {
      const owner = await actor(c),
        id = await deleteIssue(
          c.env.DB,
          identifier,
          owner,
          parsed.data.expectedVersion,
        );
      await processDeletedIssueFiles(c.env, id);
      const result = await receipt(c, owner, identifier);
      return c.json(result, result.cleanup === "complete" ? 200 : 202);
    } catch (error) {
      if (error instanceof IssueAccessError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      if (error instanceof DeletionConflict) {
        try {
          const issue = error.version
            ? await getIssueDetail(c.env.DB, identifier, new Date())
            : undefined;
          await requireIssueProjection(c, identifier);
          return c.json(
            {
              error: error.code,
              message: error.message,
              ...(issue ? { version: issue.version, issue } : {}),
            },
            409,
          );
        } catch (admission) {
          if (admission instanceof IssueAccessError)
            return c.json(
              { error: admission.code, message: admission.message },
              admission.status,
            );
          throw admission;
        }
      }
      throw error;
    }
  });
  app.get("/issues/:identifier/deletion", async (c) => {
    const identifier = c.req.param("identifier");
    if (!identifierSchema.safeParse(identifier).success)
      return c.json({ error: "invalid_request" }, 400);
    try {
      return c.json(await receipt(c, await actor(c), identifier));
    } catch (error) {
      if (error instanceof IssueAccessError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      throw error;
    }
  });
}
