import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { testCookie } from "./native-fixture";
import { createUlid } from "../../src/core/shared/ids";
import { savedViewSchema } from "../../src/core/features/views/schema";
import { getView, listViews } from "../../src/core/features/views/service";
const app = createServerApp(),
  origin = "https://vector.test";
let owner: string, other: string;
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00Z"));
  owner = await testCookie(env.DB, ids.sarah);
  other = await testCookie(env.DB, ids.maya);
});
const call = (path = "", method = "GET", body?: unknown, cookie = owner) =>
  app.request(
    origin + "/api/views" + path,
    {
      method,
      headers: { cookie, origin, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { ...env, APP_ORIGIN: origin },
  );
it("[VIEW-002 OPS-001] private views return 404 to other actors; shared views allow read and duplicate but return 403 for mutations", async () => {
  expect((await call("", "GET", undefined, "")).status).toBe(401);
  const response = await call("", "POST", {
    name: "Private triage",
    layout: "board",
    query: {
      priority: "urgent",
      grouping: "status",
      label: ids.reliabilityLabel,
      offset: 50,
    },
  });
  expect(response.status).toBe(201);
  const view = savedViewSchema.parse(await response.json());
  expect(view.query.offset).toBe(0);
  expect(view.layout).toBe("board");
  expect(view.isShared).toBe(false);
  for (const [suffix, method, body] of [
    ["", "GET", undefined],
    ["", "PATCH", { name: "Bad rename" }],
    ["", "DELETE", undefined],
    ["/duplicate", "POST", { name: "Bad duplicate" }],
  ] as const)
    expect(
      (await call("/" + view.id + suffix, method, body, other)).status,
    ).toBe(404);
  expect(
    JSON.stringify(await (await call("", "GET", undefined, other)).json()),
  ).not.toContain(view.id);
  const shared = await call("/" + view.id, "PATCH", {
    isShared: true,
    name: "Shared triage",
  });
  expect(shared.status).toBe(200);
  expect((await call("/" + view.id, "GET", undefined, other)).status).toBe(200);
  for (const method of ["PATCH", "DELETE"])
    expect(
      (
        await call(
          "/" + view.id,
          method,
          method === "PATCH" ? { name: "Bad rename" } : undefined,
          other,
        )
      ).status,
    ).toBe(403);
  const copied = await call(
    "/" + view.id + "/duplicate",
    "POST",
    { name: "My copied triage" },
    other,
  );
  expect(copied.status).toBe(201);
  const copy = savedViewSchema.parse(await copied.json());
  expect(copy.ownerOperatorId).toBe(ids.maya);
  expect(copy.isShared).toBe(false);
  expect(copy.layout).toBe("board");
  expect(copy.query).toEqual(view.query);
  const updated = savedViewSchema.parse(
    await (
      await call("/" + view.id, "PATCH", {
        layout: "list",
        query: { due: "none", sort: "due", grouping: "team" },
      })
    ).json(),
  );
  expect(updated.query.due).toBe("none");
  expect(updated.layout).toBe("list");
  expect(
    (await call("", "POST", { name: "Shared triage", query: {} })).status,
  ).toBe(409);
  const before = (
    await env.DB.prepare("SELECT * FROM issues ORDER BY id").all()
  ).results;
  expect((await call("/" + view.id, "DELETE")).status).toBe(200);
  expect((await call("/" + view.id)).status).toBe(404);
  expect(
    (await env.DB.prepare("SELECT * FROM issues ORDER BY id").all()).results,
  ).toEqual(before);
});
it("[VIEW-002 ISSUE-014] deleting a label cleans saved query filters without changing layout, sort or grouping", async () => {
  const view = savedViewSchema.parse(
    await (
      await call("", "POST", {
        name: "Label cascade",
        layout: "board",
        query: { label: ids.customerLabel, sort: "due", grouping: "team" },
      })
    ).json(),
  );
  const result = await app.request(
    origin + "/api/settings/labels/" + ids.customerLabel,
    { method: "DELETE", headers: { cookie: owner, origin } },
    { ...env, APP_ORIGIN: origin },
  );
  expect(result.status).toBe(200);
  const refreshed = savedViewSchema.parse(
    await (await call("/" + view.id)).json(),
  );
  expect(refreshed.query.label).toBe("all");
  expect(refreshed.layout).toBe("board");
  expect(refreshed.query.sort).toBe("due");
  expect(refreshed.query.grouping).toBe("team");
});
it("[VIEW-002] the hundred-view limit is atomic under simultaneous saves and duplicates", async () => {
  await env.DB.prepare("DELETE FROM saved_views WHERE owner_operator_id=?")
    .bind(ids.maya)
    .run();
  await env.DB.batch(
    Array.from({ length: 99 }, (_, i) =>
      env.DB.prepare(
        "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,created_at,updated_at) VALUES(?,?,?,?,'issues','now','now')",
      ).bind(createUlid(new Date()), ids.workspace, ids.maya, `Limit ${i}`),
    ),
  );
  const responses = await Promise.all([
    call("", "POST", { name: "Last slot A", query: {} }, other),
    call(
      "/" + ids.savedView + "/duplicate",
      "POST",
      { name: "Last slot B" },
      other,
    ),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM saved_views WHERE owner_operator_id=?",
    )
      .bind(ids.maya)
      .first<number>("n"),
  ).toBe(100);
  expect(
    (await call("", "POST", { name: "Over limit", query: {} }, other)).status,
  ).toBe(409);
  expect(
    (
      await call(
        "/" + ids.savedView + "/duplicate",
        "POST",
        { name: "Over limit duplicate" },
        other,
      )
    ).status,
  ).toBe(409);
});
it("[VIEW-002 BASE-ACCESS-001] late actor removal or workspace change hides saved view projections", async () => {
  const wrapped = new Proxy(env.DB, {
    get(target, key) {
      if (key === "prepare")
        return (sql: string) => {
          const statement = target.prepare(sql);
          if (!/SELECT \* FROM saved_views/.test(sql)) return statement;
          const wrap = (s: D1PreparedStatement): D1PreparedStatement =>
            new Proxy(s, {
              get(t, p) {
                if (p === "bind")
                  return (...args: unknown[]) => wrap(t.bind(...args));
                if (p === "all" || p === "first")
                  return async () => {
                    const result = await t[p]();
                    await env.DB.prepare(
                      "UPDATE operators SET removed_at='now' WHERE id=?",
                    )
                      .bind(ids.sarah)
                      .run();
                    return result;
                  };
                const v = Reflect.get(t, p);
                return typeof v === "function" ? v.bind(t) : v;
              },
            });
          return wrap(statement);
        };
      const v = Reflect.get(target, key);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
  try {
    await expect(listViews(wrapped, ids.sarah)).rejects.toMatchObject({
      status: 401,
    });
  } finally {
    await env.DB.prepare("UPDATE operators SET removed_at=NULL WHERE id=?")
      .bind(ids.sarah)
      .run();
  }
  try {
    await expect(
      getView(wrapped, ids.sarah, ids.savedView),
    ).rejects.toMatchObject({ status: 401 });
  } finally {
    await env.DB.prepare("UPDATE operators SET removed_at=NULL WHERE id=?")
      .bind(ids.sarah)
      .run();
  }
});
