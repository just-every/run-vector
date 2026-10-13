import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { testCookie } from "./native-fixture";
import { listIssues } from "../../src/core/features/issues/list";
import { issueListQuerySchema } from "../../src/core/features/issues/list-schema";
import { getView, listViews } from "../../src/core/features/views/service";
import { createUlid } from "../../src/core/shared/ids";
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00Z"));
});
function afterRead(pattern: RegExp, run: () => Promise<unknown>) {
  let fired = false;
  return new Proxy(env.DB, {
    get(target, key) {
      if (key === "prepare")
        return (sql: string) => {
          const wrap = (s: D1PreparedStatement): D1PreparedStatement =>
            new Proxy(s, {
              get(t, p) {
                if (p === "bind")
                  return (...args: unknown[]) => wrap(t.bind(...args));
                if (p === "all" || p === "first")
                  return async (...args: [string?]) => {
                    const result = await (
                      t[p] as (...values: [string?]) => Promise<unknown>
                    )(...args);
                    if (!fired && pattern.test(sql)) {
                      fired = true;
                      await run();
                    }
                    return result;
                  };
                const v = Reflect.get(t, p);
                return typeof v === "function" ? v.bind(t) : v;
              },
            });
          return wrap(target.prepare(sql));
        };
      const v = Reflect.get(target, key);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}
it("[VIEW-002 VIEW-003 BASE-ACCESS-001] revoking the session during a read hides saved views and preferences", async () => {
  for (const [path, pattern] of [
    ["/views", /SELECT \* FROM saved_views/],
    ["/views/" + ids.savedView, /SELECT \* FROM saved_views/],
    [
      "/preferences/current",
      /SELECT filters_json,sort,grouping FROM list_preferences/,
    ],
  ] as const) {
    const cookie = await testCookie(env.DB, ids.sarah),
      db = afterRead(pattern, () =>
        env.DB.prepare(
          "UPDATE oa_sessions SET revoked_at='now' WHERE operator_id=?",
        )
          .bind(ids.sarah)
          .run(),
      );
    const response = await createServerApp().request(
      "https://vector.test/api" + path,
      { headers: { cookie } },
      { ...env, DB: db, APP_ORIGIN: "https://vector.test" },
    );
    expect(response.status, path).toBe(401);
    expect(await response.text()).not.toContain("Reliability: retry trends");
  }
});
it("[VIEW-002] making a shared view private during projection hides its DTO", async () => {
  for (const get of [
    (db: D1Database) => getView(db, ids.maya, ids.savedView),
    (db: D1Database) => listViews(db, ids.maya),
  ]) {
    await env.DB.prepare("UPDATE saved_views SET is_shared=1 WHERE id=?")
      .bind(ids.savedView)
      .run();
    const db = afterRead(/SELECT \* FROM saved_views/, () =>
      env.DB.prepare("UPDATE saved_views SET is_shared=0 WHERE id=?")
        .bind(ids.savedView)
        .run(),
    );
    await expect(get(db)).rejects.toMatchObject({ status: 404 });
  }
  await env.DB.prepare("UPDATE saved_views SET is_shared=1 WHERE id=?")
    .bind(ids.savedView)
    .run();
});
it("[VIEW-001 BASE-ACCESS-001] a workspace switch after the SQL page refuses the entire projection", async () => {
  const workspace = createUlid(new Date());
  await env.DB.prepare(
    "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,'Other','UTC','now','now')",
  )
    .bind(workspace)
    .run();
  const db = new Proxy(env.DB, {
    get(target, key) {
      if (key === "batch")
        return async (statements: D1PreparedStatement[]) => {
          const result = await target.batch(statements);
          await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
            .bind(workspace, ids.sarah)
            .run();
          return result;
        };
      const v = Reflect.get(target, key);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
  try {
    await expect(
      listIssues(db, ids.sarah, issueListQuerySchema.parse({})),
    ).rejects.toMatchObject({ status: 401 });
  } finally {
    await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
      .bind(ids.workspace, ids.sarah)
      .run();
  }
});
it("[VIEW-002 OPS-001 BASE-ACCESS-001] even shared views in another workspace are invisible", async () => {
  const workspace = createUlid(new Date()),
    operator = createUlid(new Date()),
    view = createUlid(new Date());
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,'Foreign','UTC','now','now')",
    ).bind(workspace),
    env.DB.prepare(
      "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,'Foreign',?,'now','now')",
    ).bind(operator, workspace, operator + "@foreign.test"),
    env.DB.prepare(
      "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,is_shared,created_at,updated_at) VALUES(?,?,?,'Foreign private content','issues',1,'now','now')",
    ).bind(view, workspace, operator),
  ]);
  await expect(getView(env.DB, ids.sarah, view)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    (await listViews(env.DB, ids.sarah)).views.some((row) => row.id === view),
  ).toBe(false);
});
