import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { createApiApp } from "../../src/core/app/api";
import { bindings, origin, request } from "./base-auth-fixture";
import { changeSubscription } from "../../src/core/features/notifications/mutations";
import { beforeBatch } from "./administration-fixture";
import { removeOperator } from "../../src/core/features/settings/removal";
contractWith(
  it,
  "BASE-ACCESS-002 BASE-ACCESS-004 NOTIFY-004",
  "new private surfaces preserve origin, expiry and post-projection session reauthorization",
  async () => {
    const f = await collaborationFixture(),
      issue = await f.create({ assigneeOperatorId: f.bob });
    const app = createApiApp();
    const bad = await app.request(
      origin + `/issues/${issue.identifier}/subscription`,
      {
        method: "PATCH",
        headers: {
          host: new URL(origin).host,
          cookie: f.bobCookie,
          origin: "https://wrong.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ following: false }),
      },
      bindings,
    );
    expect(bad.status).toBe(403);
    // Revoke native sessions after the private inbox query has produced its rows.
    let fired = false;
    function wrap(
      statement: D1PreparedStatement,
      query: string,
    ): D1PreparedStatement {
      return new Proxy(statement, {
        get(target, key) {
          if (key === "bind")
            return (...args: unknown[]) => wrap(target.bind(...args), query);
          if (key === "all")
            return async () => {
              const result = await target.all();
              if (
                !fired &&
                query.includes("FROM notifications n JOIN issues")
              ) {
                fired = true;
                await env.DB.prepare(
                  "UPDATE oa_sessions SET revoked_at=? WHERE operator_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)",
                )
                  .bind(Date.now(), f.bob)
                  .run();
              }
              return result;
            };
          const value = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    }
    const db = new Proxy(env.DB, {
      get(target, key) {
        if (key === "prepare")
          return (query: string) => wrap(target.prepare(query), query);
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const res = await app.request(
      origin + "/notifications",
      { headers: { host: new URL(origin).host, cookie: f.bobCookie } },
      { ...bindings, DB: db },
    );
    expect([fired, res.status, await res.text()]).toEqual([
      true,
      401,
      expect.not.stringContaining("Authored work"),
    ]);
    for (const path of [
      "/notifications",
      "/notifications/count",
      "/settings/notifications",
      "/mentions/options",
      `/issues/${issue.identifier}/subscription`,
    ])
      expect(
        (await request("/api" + path, "GET", undefined, f.bobCookie)).status,
      ).toBe(401);
  },
);
contractWith(
  it,
  "BASE-ACCESS-004 NOTIFY-002 NOTIFY-004 OPS-004",
  "removal during a subscription mutation cannot recreate erased personal state",
  async () => {
    const f = await collaborationFixture(),
      issue = await f.create();
    const db = beforeBatch(() => removeOperator(env.DB, f.owner, f.bob));
    await expect(
      changeSubscription(db, f.bob, issue.identifier, {
        following: true,
        muted: true,
      }),
    ).rejects.toThrow();
    expect(await count("issue_followers", "operator_id=?", [f.bob])).toBe(0);
    expect(
      await count("issue_notification_mutes", "operator_id=?", [f.bob]),
    ).toBe(0);
  },
);
contractWith(
  it,
  "NOTIFY-004 BASE-INPUT-001",
  "zero-byte streamed POST read/read-all succeeds and nonempty unknown body fields remain rejected",
  async () => {
    const f = await collaborationFixture();
    await f.create({ assigneeOperatorId: f.bob });
    const item = (await f.data(f.bobCookie, "/notifications")).items[0];
    const native = createApiApp();
    const empty = (path: string) =>
      native.request(
        new Request(origin + path, {
          method: "POST",
          headers: { host: new URL(origin).host, origin, cookie: f.bobCookie },
          body: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
        }),
        undefined,
        bindings,
      );
    expect((await empty(`/notifications/${item.id}/read`)).status).toBe(200);
    expect((await empty("/notifications/read-all")).status).toBe(200);
    expect(
      (await empty("/notifications/00000000000000000000000000000000/read"))
        .status,
    ).toBe(404);
    expect(
      (
        await f.any(f.bobCookie, "/notifications/read-all", "POST", {
          operatorId: f.cara,
        })
      ).status,
    ).toBe(400);
  },
);
