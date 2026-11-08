import type { Hono } from "hono";
import type { AppEnvironment } from "../../../app/bindings";
import { readRequestJson } from "../../../app/input";
import { integrationOwner } from "../authority";
import {
  figmaManager,
  readFigmaApp,
  saveFigmaApp,
  removeFigmaApp,
} from "./configuration";
import {
  connectionStatus,
  beginConnection,
  completeConnection,
  disconnectFigma,
} from "./connection";
import { pluginManifest } from "./urls";

export function addFigmaRoutes(app: Hono<AppEnvironment>) {
  app.get("/settings/integrations/figma", async (c) =>
    c.json(await readFigmaApp(c.env, await figmaManager(c.env, c.req.raw))),
  );
  app.post("/settings/integrations/figma", async (c) =>
    c.json(
      await saveFigmaApp(
        c.env,
        await figmaManager(c.env, c.req.raw),
        await readRequestJson(c.req.raw),
      ),
    ),
  );
  app.delete("/settings/integrations/figma", async (c) =>
    c.json(await removeFigmaApp(c.env, await figmaManager(c.env, c.req.raw))),
  );
  app.get("/settings/figma", async (c) =>
    c.json(
      await connectionStatus(c.env, await integrationOwner(c.env, c.req.raw)),
    ),
  );
  app.post("/settings/figma/connect", async (c) =>
    c.json(
      await beginConnection(c.env, await integrationOwner(c.env, c.req.raw)),
    ),
  );
  app.delete("/settings/figma", async (c) =>
    c.json(
      await disconnectFigma(c.env, await integrationOwner(c.env, c.req.raw)),
    ),
  );
  app.get("/settings/figma/callback", async (c) => {
    if (
      new URL(c.req.url).searchParams.size !== Object.keys(c.req.query()).length
    )
      return c.json({ error: "figma_oauth_refused" }, 400);
    await completeConnection(
      c.env,
      await integrationOwner(c.env, c.req.raw),
      c.req.query(),
    );
    return c.redirect("/app/settings/account?figma=connected", 303);
  });
  app.get("/settings/figma/manifest", (c) =>
    c.json(pluginManifest(c.env.APP_ORIGIN), 200, {
      "Content-Disposition": 'attachment; filename="manifest.json"',
    }),
  );
}
