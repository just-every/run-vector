import { readEmptyBody } from "./input";
import type { Hono, Context } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { requireOperator } from "../auth/service";
import { operatorProjectionAdmitted } from "../auth/projection-admission";
import { settingsActor, SettingsError } from "../settings/repository";
import { IssueAccessError } from "../issues/access";
import { notificationKinds } from "./schema";
import { notificationEmailAvailable } from "./context";
import { inbox, unreadCount, subscription, preferences } from "./read";
import { markRead, changeSubscription, changePreferences } from "./mutations";
import { snooze, unsnooze, reminders, createReminder, cancelReminder } from '../notification-followups/repository';
const snoozeSchema = z.union([z.object({ until: z.iso.datetime() }).strict(), z.object({ untilChange: z.literal(true) }).strict()]);
const reminderSchema = z.object({ remindAt: z.iso.datetime() }).strict();
const id = z.string().regex(/^[a-f0-9]{32}$/);
const identifier = z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
const cursorSchema = z.object({ at: z.iso.datetime(), id }).strict();
const pageSchema = z
  .object({
    cursor: z.string().max(512).optional(),
    snoozed: z.literal("true").optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  })
  .strict();
const subscriptionSchema = z
  .object({ following: z.boolean().optional(), muted: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
const preferenceSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    mutedKinds: z
      .array(z.enum(notificationKinds))
      .max(notificationKinds.length)
      .refine((v) => new Set(v).size === v.length)
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export function addNotificationRoutes(app: Hono<AppEnvironment>) {
  const protect =
    (run: (c: Context<AppEnvironment>) => Promise<unknown>) =>
    async (c: Context<AppEnvironment>) => {
      try {
        if (
          c.req.method !== "GET" ||
          !/^(?:\/api)?\/notifications$/.test(c.req.path)
        )
          z.object({}).strict().parse(c.req.query());
        const admitted = c.get('operator');
        if (!admitted || admitted.id !== c.get("operatorId"))
          return c.json({ error: "unauthenticated" }, 401);
        const workspace = c.get('documentProjection') ? admitted.workspaceId
          : (await settingsActor(c.env.DB, admitted.id)).workspace_id;
        const data = await run(c);
        // Revalidate the native session (including Base version and expiry), not
        // only its earlier product operator snapshot, after asynchronous projection.
        const current = c.get('documentProjection') ? admitted : await requireOperator(c.env, c.req.raw);
        if (
          !current ||
          current.id !== admitted.id ||
          JSON.stringify(current.fence) !== JSON.stringify(admitted.fence)
        )
          return c.json({ error: "unauthenticated" }, 401);
        if (
          !(await operatorProjectionAdmitted(
            c.env.DB,
            admitted.id,
            workspace,
            admitted.fence,
          ))
        )
          return c.json({ error: "unauthenticated" }, 401);
        return c.json(data);
      } catch (error) {
        if (error instanceof SettingsError || error instanceof IssueAccessError)
          return c.json(
            { error: error.code, message: error.message },
            error.status,
          );
        if (
          error instanceof z.ZodError ||
          error instanceof DOMException ||
          error instanceof SyntaxError
        )
          return c.json({ error: "invalid_request" }, 400);
        throw error;
      }
    };
  app.get(
    "/notifications/count",
    protect(async (c) => ({
      unreadCount: await unreadCount(c.env.DB, c.get("operatorId")),
    })),
  );
  app.get(
    "/notifications",
    protect(async (c) => {
      const query = pageSchema.parse(c.req.query());
      const cursor = query.cursor
        ? cursorSchema.parse(JSON.parse(atob(query.cursor)))
        : undefined;
      return inbox(c.env.DB, c.get("operatorId"), query.limit, cursor, query.snoozed === "true");
    }),
  );
  app.post(
    "/notifications/read-all",
    protect(async (c) => {
      await readEmptyBody(c.req.raw);
      await markRead(c.env.DB, c.get("operatorId"));
      return { unreadCount: await unreadCount(c.env.DB, c.get("operatorId")) };
    }),
  );
  app.post(
    "/notifications/:id/read",
    protect(async (c) => {
      await readEmptyBody(c.req.raw);
      await markRead(
        c.env.DB,
        c.get("operatorId"),
        id.parse(c.req.param("id")),
      );
      return { unreadCount: await unreadCount(c.env.DB, c.get("operatorId")) };
    }),
  );
  app.post('/notifications/:id/snooze', protect(async (c) => {
    await snooze(c.env.DB, c.get('operatorId'), id.parse(c.req.param('id')), snoozeSchema.parse(await readRequestJson(c.req.raw)));
    return { unreadCount: await unreadCount(c.env.DB, c.get('operatorId')) };
  }));
  app.post('/notifications/:id/unsnooze', protect(async (c) => {
    await readEmptyBody(c.req.raw);
    await unsnooze(c.env.DB, c.get('operatorId'), id.parse(c.req.param('id')));
    return { unreadCount: await unreadCount(c.env.DB, c.get('operatorId')) };
  }));
  app.get('/issues/:identifier/reminders', protect((c) => reminders(c.env.DB, c.get('operatorId'), identifier.parse(c.req.param('identifier')))));
  app.post('/issues/:identifier/reminders', protect(async (c) => {
    const body = reminderSchema.parse(await readRequestJson(c.req.raw));
    return createReminder(c.env.DB, c.get('operatorId'), identifier.parse(c.req.param('identifier')), body.remindAt);
  }));
  app.delete('/issues/:identifier/reminders/:id', protect(async (c) => {
    await readEmptyBody(c.req.raw);
    return cancelReminder(c.env.DB, c.get('operatorId'), identifier.parse(c.req.param('identifier')), id.parse(c.req.param('id')));
  }));
  app.get(
    "/issues/:identifier/subscription",
    protect((c) =>
      subscription(
        c.env.DB,
        c.get("operatorId"),
        identifier.parse(c.req.param("identifier")),
      ),
    ),
  );
  app.patch(
    "/issues/:identifier/subscription",
    protect(async (c) => {
      const key = identifier.parse(c.req.param("identifier"));
      await changeSubscription(
        c.env.DB,
        c.get("operatorId"),
        key,
        subscriptionSchema.parse(await readRequestJson(c.req.raw)),
      );
      return subscription(c.env.DB, c.get("operatorId"), key);
    }),
  );
  app.get(
    "/settings/notifications",
    protect((c) =>
      preferences(
        c.env.DB,
        c.get("operatorId"),
        notificationEmailAvailable(c.env),
      ),
    ),
  );
  app.patch(
    "/settings/notifications",
    protect(async (c) => {
      await changePreferences(
        c.env.DB,
        c.get("operatorId"),
        preferenceSchema.parse(await readRequestJson(c.req.raw)),
      );
      return preferences(
        c.env.DB,
        c.get("operatorId"),
        notificationEmailAvailable(c.env),
      );
    }),
  );
  app.get(
    "/mentions/options",
    protect(async (c) => {
      const access = await settingsActor(c.env.DB, c.get("operatorId"));
      return {
        operators: (
          await c.env.DB.prepare(
            `SELECT o.id,o.name FROM operators o WHERE o.workspace_id=? AND o.removed_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM vector_auth_operators m JOIN oa_operators a ON a.id=m.auth_id WHERE m.operator_id=o.id AND a.status<>'active') ORDER BY o.name,o.id`,
          )
            .bind(access.workspace_id)
            .all()
        ).results,
      };
    }),
  );
}
