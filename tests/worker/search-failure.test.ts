import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnvironment } from "../../src/core/app/bindings";
import {
  addSearchRoutes,
  searchWorkspace,
} from "../../src/core/features/search";
import { SearchIndexError } from "../../src/core/features/search/service";
import { testCookie } from "./native-fixture";
import { searchFixture } from "./search-fixture";

it("[SEARCH-002 SEARCH-003] primary case-insensitive exact lookup survives failed FTS and nonexact search visibly fails with its last successful index time", async () => {
  const f = await searchFixture(),
    issue = await f.issue("Failurevanadium");
  const cookie = await testCookie(env.DB, f.actor.id);
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.set("operatorId", f.actor.id);
    await next();
  });
  addSearchRoutes(app);
  for (const query of [
    "",
    "?q=",
    "?q=%20",
    "?q=x&includeArchived=maybe",
    "?q=x&at=wrong",
    "?q=" + "x".repeat(201),
  ]) {
    const invalid = await app.request(
      "https://vector.test/search" + query,
      { headers: { cookie } },
      { ...env, APP_ORIGIN: "https://vector.test" },
    );
    expect(invalid.status).toBe(400);
  }
  await env.DB.prepare("DROP TABLE search_issues").run();
  expect(
    (
      await searchWorkspace(
        env.DB,
        f.actor.id,
        issue.identifier.toLowerCase(),
        false,
      )
    ).issues,
  ).toEqual([issue]);
  await expect(
    searchWorkspace(env.DB, f.actor.id, "Failurevanadium", false),
  ).rejects.toBeInstanceOf(SearchIndexError);
  const response = await app.request(
    "https://vector.test/search?q=Failurevanadium",
    { headers: { cookie } },
    { ...env, APP_ORIGIN: "https://vector.test" },
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    error: "search_unavailable",
    lastSuccessfulIndexAt: expect.any(String),
  });
  await env.DB.prepare("UPDATE teams SET archived_at='2026-10-01' WHERE id=?")
    .bind(f.team.id)
    .run();
  expect(
    (await searchWorkspace(env.DB, f.actor.id, issue.identifier, false)).issues,
  ).toEqual([]);
  expect(
    (await searchWorkspace(env.DB, f.actor.id, issue.identifier, true)).issues,
  ).toEqual([issue]);
  await env.DB.prepare("UPDATE teams SET archived_at=NULL WHERE id=?")
    .bind(f.team.id)
    .run();
  const before = await env.DB.prepare("SELECT title FROM issues WHERE id=?")
    .bind(issue.id)
    .first();
  await expect(
    env.DB.prepare("UPDATE issues SET title='Must not commit' WHERE id=?")
      .bind(issue.id)
      .run(),
  ).rejects.toThrow();
  expect(
    await env.DB.prepare("SELECT title FROM issues WHERE id=?")
      .bind(issue.id)
      .first(),
  ).toEqual(before);
});
