import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture } from "./collaboration-fixture";
import { createApiApp } from "../../src/core/app/api";
import { bindings, origin } from "./base-auth-fixture";
contractWith(
  it,
  "BASE-ACCESS-002 BASE-ACCESS-004 NOTIFY-004",
  "workspace membership changes during projection fail closed and old-workspace count, issue mutes and delivery titles remain private",
  async () => {
    const f = await collaborationFixture(),
      issue = await f.create({
        title: "OLD WORKSPACE PRIVATE TITLE",
        assigneeOperatorId: f.bob,
      });
    await f.any(
      f.bobCookie,
      `/issues/${issue.identifier}/subscription`,
      "PATCH",
      { muted: true },
    );
    await env.DB.prepare(
      "UPDATE notification_deliveries SET status='uncertain',reason='submission_uncertain' WHERE recipient_id=?",
    )
      .bind(f.bob)
      .run();
    const previous = (await env.DB.prepare(
      "SELECT workspace_id FROM operators WHERE id=?",
    )
      .bind(f.bob)
      .first<string>("workspace_id"))!;
    const destination = "01J00000000000000000000771";
    await env.DB.prepare(
      "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,'Other workspace','UTC','now','now')",
    )
      .bind(destination)
      .run();
    for (const [path, match] of [
      ["/notifications", "FROM notifications n JOIN issues"],
      ["/mentions/options", "SELECT o.id,o.name FROM operators"],
      ["/settings/notifications", "FROM issue_notification_mutes m"],
    ] as const) {
      let fired = false;
      const wrap = (
        statement: D1PreparedStatement,
        query: string,
      ): D1PreparedStatement =>
        new Proxy(statement, {
          get(target, key) {
            if (key === "bind")
              return (...values: unknown[]) =>
                wrap(target.bind(...values), query);
            if (key === "all")
              return async () => {
                const result = await target.all();
                if (!fired && query.includes(match)) {
                  fired = true;
                  await env.DB.prepare(
                    "UPDATE operators SET workspace_id=? WHERE id=?",
                  )
                    .bind(destination, f.bob)
                    .run();
                }
                return result;
              };
            const value = Reflect.get(target, key, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      const db = new Proxy(env.DB, {
        get(target, key) {
          if (key === "prepare")
            return (query: string) => wrap(target.prepare(query), query);
          const value = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const response = await createApiApp().request(
        origin + path,
        { headers: { host: new URL(origin).host, cookie: f.bobCookie } },
        { ...bindings, DB: db },
      );
      expect(fired, path).toBe(true);
      expect(response.status, path).toBe(401);
      expect(await response.text()).not.toContain(
        "OLD WORKSPACE PRIVATE TITLE",
      );
      await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
        .bind(previous, f.bob)
        .run();
    }
    await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
      .bind(destination, f.bob)
      .run();
    const native = createApiApp();
    const read = async (path: string) => {
      const r = await native.request(
        origin + path,
        { headers: { host: new URL(origin).host, cookie: f.bobCookie } },
        bindings,
      );
      expect(r.status, await r.clone().text()).toBe(200);
      return r.json() as Promise<any>;
    };
    expect((await read("/notifications")).items).toEqual([]);
    expect(await read("/notifications/count")).toEqual({ unreadCount: 0 });
    const settings = await read("/settings/notifications");
    expect(settings.mutedIssues).toEqual([]);
    expect(settings.deliveries).toEqual([]);
    expect(
      (
        await native.request(
          origin + `/issues/${issue.identifier}/subscription`,
          { headers: { host: new URL(origin).host, cookie: f.bobCookie } },
          bindings,
        )
      ).status,
    ).toBe(404);
  },
);
