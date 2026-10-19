import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { requireIssueProjection } from "../issues/projection-access";
import { requireIssueAccess, IssueAccessError } from "../issues/access";
import { IssueMutationError } from "../issues/errors";
import { TeamMoveError } from "../team-move/errors";
import { copyIssue } from "./service";
import { copyIssueSchema, CopyConflict } from "./schema";
export function addIssueCopyRoutes(app: Hono<AppEnvironment>, native = true) {
  app.post("/issues/:identifier/copy", async (c) => {
    const identifier = c.req.param("identifier"),
      parsed = copyIssueSchema.safeParse(await readRequestJson(c.req.raw));
    if (!/^[A-Z]{2,10}-[1-9][0-9]*$/.test(identifier) || !parsed.success)
      return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await copyIssue(
        c.env.DB,
        identifier,
        c.get("operatorId"),
        parsed.data,
      );
      if (native) {
        await requireIssueProjection(c, identifier);
        await requireIssueProjection(c, result.issue.identifier);
      } else {
        await requireIssueAccess(c.env.DB, identifier, c.get("operatorId"));
        await requireIssueAccess(
          c.env.DB,
          result.issue.identifier,
          c.get("operatorId"),
        );
      }
      return c.json(result, 201);
    } catch (error) {
      if (error instanceof CopyConflict)
        return c.json({ error: "stale_version", message: error.message }, 409);
      if (error instanceof IssueAccessError || error instanceof TeamMoveError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      if (error instanceof IssueMutationError)
        return c.json({ error: error.code, message: error.message }, 400);
      throw error;
    }
  });
}
