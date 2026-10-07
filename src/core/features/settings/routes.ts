import { AuthError } from '../../../../vendor/base/operator-auth/index.mjs';
import { baseAuth } from '../auth/base.server';
import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { clearSessionCookie } from "../auth/service";
import { timezoneSchema } from "../bootstrap/config";
import { readSettings, SettingsError, updateTimezone } from "./repository";
import { removeOperator } from "./removal";

export function addSettingsRoutes(app: Hono<AppEnvironment>) {
  app.post('/settings/operators/invite', async c => {
    const parsed = z.object({ email: z.email().max(254), displayName: z.string().trim().min(1).max(120) }).strict()
      .safeParse(await readRequestJson(c.req.raw));
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    try {
      const result = await baseAuth(c.env).invite(c.req.raw, { ...parsed.data, role: 'owner', returnTo: '/app' });
      return c.json(result, 202);
    } catch (error) {
      if (error instanceof AuthError) return Response.json({ error: error.code, message: error.code === 'mail_unavailable' ? 'Email delivery failed. Request a new invitation after the mail service is available.' : error.code }, { status: error.status });
      throw error;
    }
  });
  app.get("/settings", async (c) => {
    try {
      return c.json(await readSettings(c.env.DB, c.get("operatorId")));
    } catch (error) {
      if (error instanceof SettingsError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      throw error;
    }
  });
  app.patch("/settings", async (c) => {
    const parsed = z
      .object({ timezone: timezoneSchema })
      .strict()
      .safeParse(await readRequestJson(c.req.raw));
    if (!parsed.success)
      return c.json(
        { error: "invalid_request", issues: parsed.error.issues },
        400,
      );
    try {
      await updateTimezone(c.env.DB, c.get("operatorId"), parsed.data.timezone);
      return c.json(await readSettings(c.env.DB, c.get("operatorId")));
    } catch (error) {
      if (error instanceof SettingsError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      throw error;
    }
  });
  app.delete("/settings/operators/:operatorId", async (c) => {
    const target = c.req.param("operatorId");
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(target))
      return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await removeOperator(
        c.env.DB,
        c.get("operatorId"),
        target,
      );
      if (result.signedOut)
        c.header("Set-Cookie", clearSessionCookie(c.env, c.req.raw));
      return c.json(result);
    } catch (error) {
      if (error instanceof SettingsError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      throw error;
    }
  });
}
