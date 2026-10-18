import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { z } from "zod";
import { readRequestJson } from "../../app/input";
import { requireIssueProjection } from "../issues/projection-access";
import { IssueAccessError } from "../issues/access";
import { IssueMutationError } from "../issues/errors";
import {
  createSubissueSchema,
  identifierSchema,
  reorderSubissuesSchema,
  updateSubissueRuleSchema,
} from "./schema";
import { readSubissues } from "./projection";
import { createSubissue } from "./create";
import { reorderSubissues } from "./repository";
import { readSubissueRule, updateSubissueRule } from "./rules";
import { requireTeamProjection } from "./access";

export function addSubissueRoutes(app: Hono<AppEnvironment>) {
  app.get("/issues/:identifier/subissues", async (c) => {
    const identifier = c.req.param("identifier");
    if (!identifierSchema.safeParse(identifier).success)
      return c.json({ error: "invalid_request" }, 400);
    try {
      const data = await readSubissues(
        c.env.DB,
        identifier,
        c.get("operatorId"),
      );
      await requireIssueProjection(c, identifier);
      return c.json(data);
    } catch (error) {
      return failure(c, error);
    }
  });
  app.post("/issues/:identifier/subissues", async (c) => {
    const identifier = c.req.param("identifier"),
      input = createSubissueSchema.safeParse(await readRequestJson(c.req.raw));
    if (!identifierSchema.safeParse(identifier).success || !input.success)
      return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await createSubissue(
        c.env.DB,
        identifier,
        c.get("operatorId"),
        input.data,
      );
      const data = await readSubissues(
        c.env.DB,
        identifier,
        c.get("operatorId"),
      );
      await requireIssueProjection(c, identifier);
      if (result === "written") await c.get("drainNotifications")?.();
      return result === "stale"
        ? c.json({ error: "stale_version", subissues: data }, 409)
        : c.json(data, 201);
    } catch (error) {
      return failure(c, error);
    }
  });
  app.patch("/issues/:identifier/subissues", async (c) => {
    const identifier = c.req.param("identifier"),
      input = reorderSubissuesSchema.safeParse(
        await readRequestJson(c.req.raw),
      );
    if (!identifierSchema.safeParse(identifier).success || !input.success)
      return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await reorderSubissues(
        c.env.DB,
        identifier,
        c.get("operatorId"),
        input.data,
      );
      const data = await readSubissues(
        c.env.DB,
        identifier,
        c.get("operatorId"),
      );
      await requireIssueProjection(c, identifier);
      return result === "stale"
        ? c.json({ error: "stale_version", subissues: data }, 409)
        : c.json(data);
    } catch (error) {
      return failure(c, error);
    }
  });
  const teamIdSchema = z.string().length(26);
  app.get("/teams/:teamId/subissue-rule", async (c) => {
    const teamId = c.req.param("teamId");
    if (!teamIdSchema.safeParse(teamId).success)
      return c.json({ error: "invalid_request" }, 400);
    try {
      const rule = await readSubissueRule(
        c.env.DB,
        teamId,
        c.get("operatorId"),
      );
      await requireTeamProjection(c, teamId);
      return c.json(rule);
    } catch (error) {
      return failure(c, error);
    }
  });
  app.patch("/teams/:teamId/subissue-rule", async (c) => {
    const teamId = c.req.param("teamId"),
      input = updateSubissueRuleSchema.safeParse(
        await readRequestJson(c.req.raw),
      );
    if (!teamIdSchema.safeParse(teamId).success || !input.success)
      return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await updateSubissueRule(
        c.env.DB,
        teamId,
        c.get("operatorId"),
        input.data,
      );
      const rule = await readSubissueRule(
        c.env.DB,
        teamId,
        c.get("operatorId"),
      );
      await requireTeamProjection(c, teamId);
      return result === "stale"
        ? c.json({ error: "stale_version", rule }, 409)
        : c.json(rule);
    } catch (error) {
      return failure(c, error);
    }
  });
}
import type { Context } from "hono";
function failure(c: Context<AppEnvironment>, error: unknown) {
  if (error instanceof IssueAccessError)
    return c.json({ error: error.code, message: error.message }, error.status);
  if (error instanceof IssueMutationError)
    return c.json({ error: error.code, message: error.message }, 400);
  throw error;
}
