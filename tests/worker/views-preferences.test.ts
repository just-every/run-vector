import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { testCookie } from "./native-fixture";
import { preferenceSchema } from "../../src/core/features/views/schema";
const origin = "https://vector.test";
let owner: string, other: string;
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00Z"));
  owner = await testCookie(env.DB, ids.sarah);
  other = await testCookie(env.DB, ids.maya);
});
const call = (
  surface: string,
  method = "GET",
  body?: unknown,
  cookie = owner,
) =>
  createServerApp().request(
    origin + "/api/preferences/" + surface,
    {
      method,
      headers: { cookie, origin, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { ...env, APP_ORIGIN: origin },
  );
it("[VIEW-003] operator and surface controls survive a fresh application request, and visible reset returns persisted defaults", async () => {
  const defaults = preferenceSchema.parse(await (await call("issues")).json());
  const saved = preferenceSchema.parse(
    await (
      await call("issues", "PUT", {
        filters: { priority: "urgent", assignee: ids.sarah },
        sort: "due",
        grouping: "project",
      })
    ).json(),
  );
  expect(saved.filters.priority).toBe("urgent");
  expect(saved.sort).toBe("due");
  expect(preferenceSchema.parse(await (await call("issues")).json())).toEqual(
    saved,
  );
  expect(
    preferenceSchema.parse(
      await (await call("issues", "GET", undefined, other)).json(),
    ),
  ).toEqual(defaults);
  expect(preferenceSchema.parse(await (await call("board")).json())).toEqual({
    ...defaults,
    surface: "board",
  });
  expect(
    preferenceSchema.parse(await (await call("issues", "DELETE")).json()),
  ).toEqual(defaults);
  expect(preferenceSchema.parse(await (await call("issues")).json())).toEqual(
    defaults,
  );
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM list_preferences WHERE operator_id=? AND surface='issues'",
    )
      .bind(ids.sarah)
      .first<number>("n"),
  ).toBe(1);
});
it("[VIEW-003] each surface validates its actual controls and supports persistence and reset", async () => {
  for (const [surface, filters, sort, grouping] of [
    [
      "current",
      { teamId: ids.flow, assigneeId: "unassigned", priority: "high" },
      "priority",
      "none",
    ],
    [
      "my-work",
      { teamId: ids.platform, assigneeId: "all", priority: "urgent" },
      "priority",
      "none",
    ],
    [
      "projects",
      { lifecycle: "active", health: "blocked", includeArchived: true },
      "newest",
      "none",
    ],
    ["board", { team: ids.flow, blocked: "blocked" }, "status", "status"],
  ] as const) {
    const original = await (await call(surface)).json();
    const result = await call(surface, "PUT", { filters, sort, grouping });
    expect(result.status).toBe(200);
    const saved = preferenceSchema.parse(await result.json());
    expect(saved.filters).toMatchObject(filters);
    expect(await (await call(surface)).json()).toEqual(saved);
    expect((await call(surface, "DELETE")).status).toBe(200);
    const reset = preferenceSchema.parse(await (await call(surface)).json());
    expect(reset.sort).toBe(surface === "board" ? "newest" : sort);
    expect(reset.grouping).toBe("none");
    if (surface === "current") expect(reset).toEqual(original);
  }
  for (const [surface, body] of [
    ["issues", { filters: { offset: 50 } }],
    ["issues", { filters: { priority: "impossible" } }],
    ["issues", { filters: { dueFrom: "2026-10-03", dueTo: "2026-10-01" } }],
    ["projects", { filters: { health: "none" } }],
    ["current", { filters: {}, sort: "oldest" }],
    ["current", { filters: {}, grouping: "team" }],
    ["my-work", { filters: { teamId: "bad" } }],
    ["projects", { filters: { priority: "urgent" } }],
  ] as const)
    expect((await call(surface, "PUT", body)).status).toBe(400);
  expect((await call("unknown")).status).toBe(400);
  expect((await call("issues", "GET", undefined, "")).status).toBe(401);
});
it("[VIEW-003 VIEW-002] opening, editing and duplicating saved views never touches operator controls", async () => {
  const saved = await (
    await call("issues", "PUT", {
      filters: { priority: "low" },
      sort: "oldest",
      grouping: "assignee",
    })
  ).json();
  const app = createServerApp(),
    request = (path: string, method = "GET", body?: unknown) =>
      app.request(
        origin + "/api/views/" + path,
        {
          method,
          headers: {
            cookie: owner,
            origin,
            "content-type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        { ...env, APP_ORIGIN: origin },
      );
  expect((await request(ids.savedView)).status).toBe(200);
  expect(
    (
      await request(ids.savedView, "PATCH", {
        query: { priority: "urgent", sort: "priority", grouping: "status" },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(ids.savedView + "/duplicate", "POST", {
        name: "Independent saved view",
      })
    ).status,
  ).toBe(201);
  expect(await (await call("issues")).json()).toEqual(saved);
});
