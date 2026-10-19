import { saveCycleSchedule } from "../cycle-schedule/settings";
import { previewHousekeeping, saveHousekeeping } from "../housekeeping/settings";
import { housekeepingSchema } from "../housekeeping/schema";
import type { Hono, Context } from "hono";
import type { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import * as schema from "./schema";
import { readAdministration, readCycle } from "./read";
import { SettingsError } from "./transaction";
import {
  createTeam,
  updateTeam,
  createStatus,
  renameStatus,
  reorderStatuses,
  removeStatus,
} from "./teams";
import { createLabel, updateLabel, removeLabel } from "./labels";
import { createProject, updateProject, removeProject } from "./projects";
import { createCycle } from "./cycles";

export function addAdministrationRoutes(app: Hono<AppEnvironment>) {
  const read = async (c: Context<AppEnvironment>) =>
    c.json(await readAdministration(c.env.DB, c.get("operatorId")));
  const handle =
    (run: (c: Context<AppEnvironment>) => Promise<Response>) =>
    async (c: Context<AppEnvironment>) => {
      for (const id of Object.values(c.req.param()))
        if (!schema.administrationId.safeParse(id).success)
          return c.json({ error: "invalid_request" }, 400);
      try {
        return await run(c);
      } catch (error) {
        if (error instanceof SettingsError)
          return c.json(
            { error: error.code, message: error.message },
            error.status,
          );
        throw error;
      }
    };
  const mutation = <T extends z.ZodType>(
    input: T,
    run: (c: Context<AppEnvironment>, body: z.output<T>) => Promise<void>,
  ) =>
    handle(async (c) => {
      const parsed = input.safeParse(await readRequestJson(c.req.raw));
      if (!parsed.success)
        return c.json(
          {
            error: "invalid_request",
            message: parsed.error.issues
              .map(
                (issue) =>
                  `${issue.path.join(".") || "Input"}: ${issue.message}`,
              )
              .join(" "),
            issues: parsed.error.issues,
          },
          400,
        );
      await run(c, parsed.data);
      return read(c);
    });
  app.get("/settings/administration", handle(read));
  app.post(
    "/settings/teams",
    mutation(schema.teamCreateSchema, (c, b) =>
      createTeam(c.env.DB, c.get("operatorId"), b),
    ),
  );
  app.patch(
    "/settings/teams/:id",
    mutation(schema.teamUpdateSchema, (c, b) =>
      updateTeam(c.env.DB, c.get("operatorId"), c.req.param("id")!, b),
    ),
  );
  app.post(
    "/settings/teams/:id/statuses",
    mutation(schema.statusCreateSchema, (c, b) =>
      createStatus(c.env.DB, c.get("operatorId"), c.req.param("id")!, b),
    ),
  );
  app.put(
    "/settings/teams/:id/statuses/order",
    mutation(schema.statusReorderSchema, (c, b) =>
      reorderStatuses(
        c.env.DB,
        c.get("operatorId"),
        c.req.param("id")!,
        b.statusIds,
      ),
    ),
  );
  app.patch(
    "/settings/teams/:id/statuses/:statusId",
    mutation(schema.statusRenameSchema, (c, b) =>
      renameStatus(
        c.env.DB,
        c.get("operatorId"),
        c.req.param("id")!,
        c.req.param("statusId")!,
        b.name,
      ),
    ),
  );
  app.delete(
    "/settings/teams/:id/statuses/:statusId",
    mutation(schema.statusRemoveSchema, (c, b) =>
      removeStatus(
        c.env.DB,
        c.get("operatorId"),
        c.req.param("id")!,
        c.req.param("statusId")!,
        b.destinationStatusId,
      ),
    ),
  );
  app.post(
    "/settings/labels",
    mutation(schema.labelCreateSchema, (c, b) =>
      createLabel(c.env.DB, c.get("operatorId"), b),
    ),
  );
  app.patch(
    "/settings/labels/:id",
    mutation(schema.labelUpdateSchema, (c, b) =>
      updateLabel(c.env.DB, c.get("operatorId"), c.req.param("id")!, b),
    ),
  );
  app.delete(
    "/settings/labels/:id",
    handle(async (c) => {
      await removeLabel(c.env.DB, c.get("operatorId"), c.req.param("id")!);
      return read(c);
    }),
  );
  app.post(
    "/settings/projects",
    mutation(schema.projectCreateSchema, (c, b) =>
      createProject(c.env.DB, c.get("operatorId"), b).then(() => {}),
    ),
  );
  app.patch(
    "/settings/projects/:id",
    mutation(schema.projectUpdateSchema, (c, b) =>
      updateProject(c.env.DB, c.get("operatorId"), c.req.param("id")!, b),
    ),
  );
  app.delete(
    "/settings/projects/:id",
    handle(async (c) => {
      await removeProject(c.env.DB, c.get("operatorId"), c.req.param("id")!);
      return read(c);
    }),
  );
  app.post(
    "/settings/cycles",
    mutation(schema.cycleCreateSchema, (c, b) =>
      createCycle(c.env.DB, c.get("operatorId"), b),
    ),
  );
  app.put("/settings/teams/:id/cycle-schedule", mutation(schema.cycleScheduleSchema, (c,b) => saveCycleSchedule(c.env.DB,c.get("operatorId"),c.req.param("id")!,b)));
  app.put("/settings/teams/:id/housekeeping", mutation(housekeepingSchema, (c,b) => saveHousekeeping(c.env.DB,c.get("operatorId"),c.req.param("id")!,b)));
  app.post("/settings/teams/:id/housekeeping/preview", handle(async (c) => {
    const parsed = housekeepingSchema.safeParse(await readRequestJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
    return c.json(await previewHousekeeping(c.env.DB, c.get("operatorId"), c.req.param("id")!, parsed.data));
  }));
  app.get(
    "/cycles/:id",
    handle(async (c) =>
      c.json(
        await readCycle(c.env.DB, c.get("operatorId"), c.req.param("id")!),
      ),
    ),
  );
}
