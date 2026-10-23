import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { SettingsError } from "../settings/repository";
import { feedInputSchema, feedChangeSchema } from "./schema";
import { changeFeed, createFeed, feedContent, listFeeds } from "./service";

/** Register before native-session middleware: capability requests set no cookie. */
export function addCalendarFeedPublicRoutes(app: Hono<AppEnvironment>) {
  app.get("/calendar/feed/:token", async c => {
    const body = await feedContent(c.env.DB, c.req.param("token"), c.env.APP_ORIGIN);
    return new Response(body ?? "Not found", { status: body === null ? 404 : 200, headers: {
      "Content-Type": body === null ? "text/plain; charset=utf-8" : "text/calendar; charset=utf-8",
      "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
    } });
  });
}
export function addCalendarFeedRoutes(app: Hono<AppEnvironment>) {
  app.get("/calendar/feeds", async c => {
    try { return c.json(await listFeeds(c.env.DB, c.get("operatorId"))); }
    catch (error) {
      if (error instanceof SettingsError) return c.json({ error: error.code, message: error.message }, error.status);
      throw error;
    }
  });
  app.post("/calendar/feeds", async c => {
    const input = feedInputSchema.safeParse(await readRequestJson(c.req.raw));
    if (!input.success) return c.json({ error: "invalid_request", message: "Choose your own feed or one of your teams." }, 400);
    try { return c.json(await createFeed(c.env.DB, c.get("operatorId"), input.data.teamId, c.env.APP_ORIGIN), 201); }
    catch (error) {
      if (error instanceof SettingsError) return c.json({ error: error.code, message: error.message }, error.status);
      throw error;
    }
  });
  for (const [method, path, rotate] of [["POST", "/calendar/feeds/:id/rotate", true], ["DELETE", "/calendar/feeds/:id", false]] as const) app.on(method, path, async c => {
    const input = feedChangeSchema.safeParse(await readRequestJson(c.req.raw));
    if (!input.success) return c.json({ error: "invalid_request", message: "Refresh this feed before changing it." }, 400);
    try { return c.json(await changeFeed(c.env.DB, c.get("operatorId"), c.req.param("id"), input.data.expectedVersion, rotate, c.env.APP_ORIGIN)); }
    catch (error) {
      if (error instanceof SettingsError) return c.json({ error: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
