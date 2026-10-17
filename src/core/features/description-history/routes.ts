import type { Context, Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { requireIssueAccess, IssueAccessError } from "../issues/access";
import { requireIssueProjection } from "../issues/projection-access";
import { discussion } from "../discussion/repository";
import { getIssueDetail } from "../issues/service";
import { readDescriptionHistory, restoreDescription, tickDescriptionTask } from "./repository";
import { tickCommentTask } from "./comments";
import { DescriptionMutationError } from "./errors";
import { checklistSchema, commentChecklistSchema, descriptionRestoreSchema } from "./schema";

export function addDescriptionHistoryRoutes(app: Hono<AppEnvironment>, native = true) {
  async function admit(c: Context<AppEnvironment>, identifier: string) {
    if (native) return requireIssueProjection(c, identifier);
    return requireIssueAccess(c.env.DB, identifier, c.get("operatorId"));
  }
  const route = (handler: (c: Context<AppEnvironment>, identifier: string) => Promise<Response>) => async (c: Context<AppEnvironment>) => {
    const identifier = c.req.param("identifier") ?? "";
    if (!/^[A-Z]{2,10}-[1-9][0-9]*$/.test(identifier)) return c.json({ error: "invalid_request" }, 400);
    try {
      if (native) c.set("concealWorkspaceChange", true);
      return await handler(c, identifier);
    } catch (error) {
      if (error instanceof IssueAccessError || error instanceof DescriptionMutationError)
        return c.json({ error: error.code, message: error.message }, error.status);
      throw error;
    }
  };
  app.get("/issues/:identifier/description-history", route(async (c, identifier) => {
    await admit(c, identifier);
    const history = await readDescriptionHistory(c.env.DB, identifier, c.get("operatorId"));
    await admit(c, identifier);
    return c.json(history);
  }));
  for (const action of ["description-restore", "checklist"] as const) {
    app.post(`/issues/:identifier/${action}`, route(async (c, identifier) => {
      const raw = await readRequestJson(c.req.raw);
      let outcome: "written" | "stale";
      if (action === "description-restore") {
        const input = descriptionRestoreSchema.safeParse(raw);
        if (!input.success) return c.json({ error: "invalid_request" }, 400);
        outcome = await restoreDescription(c.env.DB, identifier, c.get("operatorId"), input.data);
      } else {
        const input = checklistSchema.safeParse(raw);
        if (!input.success) return c.json({ error: "invalid_request" }, 400);
        outcome = await tickDescriptionTask(c.env.DB, identifier, c.get("operatorId"), input.data);
      }
      const issue = await getIssueDetail(c.env.DB, identifier, new Date());
      await admit(c, identifier);
      return outcome === "stale"
        ? c.json({ error: "stale_version", issue, version: issue?.version }, 409)
        : c.json(issue);
    }));
  }
  app.post("/issues/:identifier/comments/:itemId/checklist", route(async (c, identifier) => {
    const id = c.req.param("itemId") ?? "";
    const input = commentChecklistSchema.safeParse(await readRequestJson(c.req.raw));
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id) || !input.success) return c.json({ error: "invalid_request" }, 400);
    await tickCommentTask(c.env.DB, identifier, id, c.get("operatorId"), input.data);
    if (native && c.req.header("x-vector-projection") === "discussion") {
      c.set("mutationPageProjection", true);
      const issue = await admit(c, identifier);
      const projection = await discussion(c.env.DB, issue.id, c.get("operatorId"));
      await admit(c, identifier);
      return c.json({ updated: true, discussion: projection });
    }
    await admit(c, identifier);
    return c.json({ updated: true });
  }));
}
