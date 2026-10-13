import type { Hono, Context } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { preferenceSurfaceSchema, preferenceInputSchema } from "./schema";
import { getPreference, putPreference, resetPreference } from "./preferences";
import { handle } from "./route-handler";
export function addPreferenceRoutes(app: Hono<AppEnvironment>) {
  const surface = (c: Context<AppEnvironment>) =>
    preferenceSurfaceSchema.parse(c.req.param("surface"));
  app.get(
    "/preferences/:surface",
    handle(async (c) =>
      c.json(await getPreference(c.env.DB, c.get("operatorId"), surface(c))),
    ),
  );
  app.put(
    "/preferences/:surface",
    handle(async (c) =>
      c.json(
        await putPreference(
          c.env.DB,
          c.get("operatorId"),
          surface(c),
          preferenceInputSchema.parse(await readRequestJson(c.req.raw)),
        ),
      ),
    ),
  );
  app.delete(
    "/preferences/:surface",
    handle(async (c) =>
      c.json(await resetPreference(c.env.DB, c.get("operatorId"), surface(c))),
    ),
  );
}
