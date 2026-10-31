import { importJiraFilterPage, isJiraBatch } from './jira-filter-batch';
import { parseViewCreate } from './jira-filter-import';
import type { Hono, Context } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import {
  updateViewSchema,
  duplicateViewSchema,
  viewIdSchema,
} from "./schema";
import {
  listViews,
  getView,
  createView,
  updateView,
  deleteView,
  duplicateView,
} from "./service";
import { handle } from "./route-handler";
export function addViewRoutes(app: Hono<AppEnvironment>) {
  const id = (c: Context<AppEnvironment>) =>
    viewIdSchema.parse(c.req.param("id"));
  app.get(
    "/views",
    handle(async (c) => c.json(await listViews(c.env.DB, c.get("operatorId")))),
  );
  app.post(
    "/views",
    handle(async (c) => {
      const body = await readRequestJson(c.req.raw);
      if (isJiraBatch(body)) {
        const imported = await importJiraFilterPage(c.env.DB, c.get('operatorId'), body);
        return c.json(imported, imported.views.length ? 201 : 422);
      }
      return c.json(await createView(c.env.DB, c.get('operatorId'), await parseViewCreate(c.env.DB, c.get('operatorId'), body)), 201);
    }),
  );
  app.get(
    "/views/:id",
    handle(async (c) =>
      c.json(await getView(c.env.DB, c.get("operatorId"), id(c))),
    ),
  );
  app.patch(
    "/views/:id",
    handle(async (c) =>
      c.json(
        await updateView(
          c.env.DB,
          c.get("operatorId"),
          id(c),
          updateViewSchema.parse(await readRequestJson(c.req.raw)),
        ),
      ),
    ),
  );
  app.delete(
    "/views/:id",
    handle(async (c) =>
      c.json(await deleteView(c.env.DB, c.get("operatorId"), id(c))),
    ),
  );
  app.post(
    "/views/:id/duplicate",
    handle(async (c) =>
      c.json(
        await duplicateView(
          c.env.DB,
          c.get("operatorId"),
          id(c),
          duplicateViewSchema.parse(await readRequestJson(c.req.raw)).name,
        ),
        201,
      ),
    ),
  );
}
