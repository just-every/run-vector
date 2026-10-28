import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { requireIssueProjection } from "../issues/projection-access";
import { IssueAccessError } from "../issues/access";
import { bulkIssueInputSchema } from "./input";
import { BulkIssueError, bulkUpdateIssues } from "./repository";
export function addBulkIssueRoutes(app: Hono<AppEnvironment>) {
  app.post("/issues/bulk", async (c) => {
    const parsed = bulkIssueInputSchema.safeParse(
      await readRequestJson(c.req.raw),
    );
    if (!parsed.success)
      return c.json(
        { error: "invalid_request", issues: parsed.error.issues },
        400,
      );
    try {
      const result = await bulkUpdateIssues(
        c.env.DB,
        c.get("operatorId"),
        parsed.data,
      );
      for (const issue of result.issues)
        await requireIssueProjection(c, issue.identifier);
      return c.json(result);
    } catch (error) {
      if (error instanceof IssueAccessError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      if (error instanceof BulkIssueError)
        return c.json(
          {
            error: "bulk_edit_failed",
            message: error.message,
            failures: error.failures,
          },
          error.failures.some((failure) => failure.reasons.includes("Start date must be on or before due date.")) ? 400 : 409,
        );
      throw error;
    }
  });
}
