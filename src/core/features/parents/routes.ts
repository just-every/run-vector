import { addSubissueRoutes } from "../subissues/routes";
import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { IssueAccessError } from "../issues/access";
import { requireIssueProjection } from "../issues/projection-access";
import { getIssueDetail } from "../issues/service";
import { IssueMutationError } from "../issues/errors";
import { updateIssueParent } from "./repository";
const identifierSchema = z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
const inputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    parentIdentifier: identifierSchema.nullable(),
  })
  .strict();
export function addParentIssueRoutes(app: Hono<AppEnvironment>) {
  addSubissueRoutes(app);
  app.patch("/issues/:identifier/parent", async (c) => {
    const identifier = c.req.param("identifier");
    const input = inputSchema.safeParse(await readRequestJson(c.req.raw));
    if (!identifierSchema.safeParse(identifier).success || !input.success)
      return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await updateIssueParent(
        c.env.DB,
        identifier,
        c.get("operatorId"),
        input.data,
      );
      const issue = await getIssueDetail(c.env.DB, identifier, new Date());
      await requireIssueProjection(c, identifier);
      return result === "stale"
        ? c.json(
            { error: "stale_version", issue, version: issue?.version },
            409,
          )
        : c.json(issue);
    } catch (error) {
      if (error instanceof IssueAccessError)
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
