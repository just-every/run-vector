import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { IssueAccessError } from "../issues/access";
import { requireIssueProjection } from "../issues/projection-access";
import { decideSelectedDuplicates } from "./duplicate";
import { bulkDuplicateInputSchema, bulkTeamInputSchema } from "./input";
import { moveSelectedIssueTeams } from "./team";
import { BulkCommandError } from "./validation";

export function addBulkCommandRoutes(app: Hono<AppEnvironment>) {
  for (const command of [
    { path: "/issues/bulk/team", schema: bulkTeamInputSchema, run: moveSelectedIssueTeams },
    { path: "/issues/bulk/duplicate", schema: bulkDuplicateInputSchema, run: decideSelectedDuplicates },
  ] as const) {
    app.post(command.path, async (c) => {
      const body = await readRequestJson(c.req.raw);
      const parsed = command.schema.safeParse(body);
      if (!parsed.success) return c.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
      try {
        // Dispatch with the matching schema; no source is sent through a
        // per-issue route, and every selection commits in one D1 transaction.
        const result = command.path === "/issues/bulk/team"
          ? await moveSelectedIssueTeams(c.env.DB, c.get("operatorId"), bulkTeamInputSchema.parse(body))
          : await decideSelectedDuplicates(c.env.DB, c.get("operatorId"), bulkDuplicateInputSchema.parse(body));
        for (const issue of result.issues) await requireIssueProjection(c, issue.identifier);
        return c.json(result);
      } catch (error) {
        if (error instanceof IssueAccessError) return c.json({ error: error.code, message: error.message }, error.status);
        if (error instanceof BulkCommandError) return c.json({
          error: "bulk_command_failed", message: error.message, failures: error.failures,
        }, 409);
        throw error;
      }
    });
  }
}
