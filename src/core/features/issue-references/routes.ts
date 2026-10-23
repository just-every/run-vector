import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { IssueAccessError, requireIssueAccess } from "../issues/access";
import { requireIssueProjection } from "../issues/projection-access";
import { readIssueReferences, readSourceIssueReferences } from "./repository";
import { browseActor } from "../issues/browse-access";
import { issueIdentifierPattern } from "./schema";

export function addIssueReferenceRoutes(app: Hono<AppEnvironment>) {
  app.get("/issues/:identifier/references", async c => {
    const identifier = c.req.param("identifier"), raw = c.req.query("identifiers") ?? "";
    const identifiers = [...new Set(raw ? raw.split(",") : [])];
    if (!issueIdentifierPattern.test(identifier) || raw.length > 16_000 || identifiers.length > 500 || identifiers.some(value => !issueIdentifierPattern.test(value)))
      return c.json({ error: "invalid_request" }, 400);
    try {
      const actor = c.get("operatorId");
      const [source, scope] = await Promise.all([
        requireIssueAccess(c.env.DB, identifier, actor), browseActor(c.env.DB, actor),
      ]);
      const references = c.req.query("identifiers") === undefined
        ? await readSourceIssueReferences(c.env.DB, actor, source.id)
        : await readIssueReferences(c.env.DB, actor, identifiers);
      const [, current] = await Promise.all([
        requireIssueProjection(c, identifier), browseActor(c.env.DB, actor, scope.workspace_id),
      ]);
      if (current.role !== scope.role || current.teamScope !== scope.teamScope)
        throw new IssueAccessError("not_found", "Issue references are unavailable. Reload and try again.", 404);
      return c.json({ references });
    } catch (error) {
      if (!(error instanceof IssueAccessError)) throw error;
      return c.json({ error: error.code, message: error.message }, error.status);
    }
  });
}
