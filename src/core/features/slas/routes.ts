import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { requireIssueAccess } from "../issues/access";
import { SettingsError } from "../settings/repository";
import { slaInput } from "./schema";
import { readSla, saveSla } from "./settings";
import { projectSla } from "./read";
export function addSlaRoutes(app: Hono<AppEnvironment>) {
  app.get("/settings/teams/:id/sla", async (c) => {
    try {
      return c.json(
        await readSla(c.env.DB, c.get("operatorId"), c.req.param("id")),
      );
    } catch (error) {
      if (error instanceof SettingsError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      throw error;
    }
  });
  app.put("/settings/teams/:id/sla", async (c) => {
    const parsed = slaInput.safeParse(await readRequestJson(c.req.raw));
    if (!parsed.success)
      return c.json(
        {
          error: "invalid_sla",
          message:
            "Choose a priority or label, valid business hours, and a warning before the target.",
        },
        400,
      );
    try {
      await saveSla(
        c.env.DB,
        c.get("operatorId"),
        c.req.param("id"),
        parsed.data,
      );
      return c.json(
        await readSla(c.env.DB, c.get("operatorId"), c.req.param("id")),
      );
    } catch (error) {
      if (error instanceof SettingsError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      throw error;
    }
  });
  app.get("/issues/:identifier/sla", async (c) => {
    await requireIssueAccess(
      c.env.DB,
      c.req.param("identifier"),
      c.get("operatorId"),
    );
    const projection = await projectSla(
      c.env.DB,
      c.req.param("identifier"),
      new Date(),
    );
    await requireIssueAccess(
      c.env.DB,
      c.req.param("identifier"),
      c.get("operatorId"),
    );
    return c.json(projection);
  });
}
