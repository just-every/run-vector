import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { findIssue } from "../discussion/repository";
import { addNamedLink, listNamedLinks, removeNamedLink } from "./repository";
import { createLinkSchema, issueIdentifier, linkId } from "./schema";

const params = z
  .object({ identifier: issueIdentifier, linkId: linkId.optional() })
  .strict();
const query = z.object({}).strict();

/** Must be registered inside the existing protected /api app. */
export function addLinkRoutes(app: Hono<AppEnvironment>) {
  for (const path of [
    "/issues/:identifier/links",
    "/issues/:identifier/links/:linkId",
  ]) {
    app.use(path, async (c, next) => {
      if (
        !params.safeParse(c.req.param()).success ||
        !query.safeParse(c.req.query()).success
      )
        return c.json({ error: "invalid_request" }, 400);
      await next();
    });
  }
  app.get("/issues/:identifier/links", async (c) => {
    const issue = await findIssue(c.env.DB, c.req.param("identifier"));
    if (!issue) return c.json({ error: "not_found" }, 404);
    return c.json({ links: await listNamedLinks(c.env.DB, issue.id) });
  });
  app.post("/issues/:identifier/links", async (c) => {
    const input = createLinkSchema.safeParse(await readRequestJson(c.req.raw));
    if (!input.success)
      return c.json(
        {
          error: "invalid_request",
          message: "A name and safe HTTPS URL are required.",
          issues: input.error.issues,
        },
        400,
      );
    const issue = await findIssue(c.env.DB, c.req.param("identifier"));
    if (!issue) return c.json({ error: "not_found" }, 404);
    const id = await addNamedLink(
      c.env.DB,
      issue,
      c.get("operatorId"),
      input.data,
    );
    return id ? c.json({ id }, 201) : c.json({ error: "not_found" }, 404);
  });
  app.delete("/issues/:identifier/links/:linkId", async (c) => {
    const issue = await findIssue(c.env.DB, c.req.param("identifier"));
    if (!issue) return c.json({ error: "not_found" }, 404);
    return (await removeNamedLink(
      c.env.DB,
      issue,
      c.req.param("linkId"),
      c.get("operatorId"),
    ))
      ? c.json({ removed: true })
      : c.json({ error: "not_found" }, 404);
  });
}
