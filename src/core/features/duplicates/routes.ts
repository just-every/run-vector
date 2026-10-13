import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { requireIssueProjection } from "../issues/projection-access";
import { getIssueDetail } from "../issues/service";
import { IssueAccessError } from "../issues/access";
import { IssueMutationError } from "../issues/errors";
import { decideDuplicate } from "./repository";
const identifier = z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
const input = z
  .object({
    expectedVersion: z.number().int().positive(),
    canonicalIdentifier: identifier.nullable(),
  })
  .strict();
export function addDuplicateRoutes(app: Hono<AppEnvironment>) {
  app.post("/issues/:identifier/duplicate", async (c) => {
    const id = c.req.param("identifier"),
      body = input.safeParse(await readRequestJson(c.req.raw));
    if (!identifier.safeParse(id).success || !body.success)
      return c.json({ error: "invalid_request" }, 400);
    try {
      const outcome = await decideDuplicate(
        c.env.DB,
        id,
        c.get("operatorId"),
        body.data,
      );
      const issue = await getIssueDetail(c.env.DB, id, new Date());
      await requireIssueProjection(c, id);
      return outcome === "stale"
        ? c.json(
            { error: "stale_version", version: issue?.version, issue },
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
        return c.json({ error: error.code, message: error.message }, 409);
      throw error;
    }
  });
}
