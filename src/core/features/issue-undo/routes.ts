import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { IssueAccessError } from "../issues/access";
import { requireIssueProjection } from "../issues/projection-access";
import { UndoError } from "./schema";
import { undoIssueAction } from "./service";
const input = z.object({ actionId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/) }).strict();
export function addIssueUndoRoutes(app: Hono<AppEnvironment>) {
  app.post("/issues/undo", async (c) => {
    const parsed = input.safeParse(await readRequestJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "invalid_request", message: "A valid action ID is required." }, 400);
    c.set("concealWorkspaceChange", true);
    try {
      const result = await undoIssueAction(c.env.DB, c.get("operatorId"), parsed.data.actionId);
      for (const issue of result.issues) await requireIssueProjection(c, issue.identifier);
      return c.json(result);
    } catch (error) {
      if (error instanceof IssueAccessError) return c.json({ error: error.code, message: error.message }, error.status);
      if (!(error instanceof UndoError)) throw error;
      // Failure identifiers are selected only from the actor's current scope,
      // then native projection admission is checked again before disclosure.
      for (const failure of error.failures) {
        try { await requireIssueProjection(c, failure.identifier); }
        catch (admission) {
          if (admission instanceof IssueAccessError) return c.json({ error: admission.code, message: admission.message }, admission.status);
          throw admission;
        }
      }
      return c.json({ error: error.code, message: error.message, failures: error.failures }, error.status);
    }
  });
}
