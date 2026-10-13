import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { searchWorkspace } from "../../src/core/features/search";
import { beforeSearchRead, searchFixture, searchNow } from "./search-fixture";

it("[SEARCH-001 SEARCH-002 VIEW-002] exact primary identifier ranks first without dropping related issues, projects or accessible views", async () => {
  const f = await searchFixture();
  const exact = await f.issue("Exact primary"),
    related = await f.issue("Related", { description: exact.identifier });
  const project = await f.project(exact.identifier + " project");
  const view = await f.view(exact.identifier + " view");
  const other = "ranking-other-owner";
  await env.DB.prepare(
    "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,'Other','ranking-other@search.test',?,?)",
  )
    .bind(other, f.actor.workspace_id, searchNow, searchNow)
    .run();
  const privateView = await f.view(exact.identifier + " private", other);
  const sharedView = await f.view(exact.identifier + " shared", other, true);
  const result = await searchWorkspace(
    env.DB,
    f.actor.id,
    exact.identifier.toLowerCase(),
    false,
  );
  expect(result.issues).toEqual([exact, related]);
  expect(result.projects.map((p) => p.id)).toEqual([project]);
  expect(new Set(result.savedViews.map((v) => v.id))).toEqual(
    new Set([view, sharedView]),
  );
  expect(result.savedViews.map((v) => v.id)).not.toContain(privateView);
  for (let n = 0; n < 52; n++)
    await f.issue("Related " + n, { description: exact.identifier });
  const bounded = await searchWorkspace(
    env.DB,
    f.actor.id,
    exact.identifier,
    false,
  );
  expect(bounded.issues).toHaveLength(50);
  expect(bounded.issues[0]).toEqual(exact);
  expect(new Set(bounded.issues.map((i) => i.id)).size).toBe(50);
  const archivedProject = await f.project("Archived exact issue project");
  await env.DB.prepare("UPDATE issues SET project_id=? WHERE id=?")
    .bind(archivedProject, exact.id)
    .run();
  await env.DB.prepare("UPDATE projects SET archived_at=? WHERE id=?")
    .bind(searchNow, archivedProject)
    .run();
  const active = await searchWorkspace(
    env.DB,
    f.actor.id,
    exact.identifier,
    false,
  );
  expect(active.issues).toHaveLength(50);
  expect(active.issues.map((i) => i.id)).not.toContain(exact.id);
  expect(
    (await searchWorkspace(env.DB, f.actor.id, exact.identifier, true))
      .issues[0],
  ).toEqual(exact);
});

it("[SEARCH-001 SEARCH-002] a changed primary record and archive choice are read again in the final result snapshot", async () => {
  const f = await searchFixture(),
    exact = await f.issue("Before primary read");
  let fired = false;
  const db = beforeSearchRead(async (sql) => {
    if (!fired && sql.includes("json_group_array")) {
      fired = true;
      await env.DB.prepare(
        "UPDATE issues SET title='After primary read' WHERE id=?",
      )
        .bind(exact.id)
        .run();
    }
  });
  expect(
    (await searchWorkspace(db, f.actor.id, exact.identifier, false)).issues[0]
      .title,
  ).toBe("After primary read");
  fired = false;
  const archived = beforeSearchRead(async (sql) => {
    if (!fired && sql.includes("json_group_array")) {
      fired = true;
      await env.DB.prepare("UPDATE teams SET archived_at=? WHERE id=?")
        .bind(searchNow, f.team.id)
        .run();
    }
  });
  expect(
    (await searchWorkspace(archived, f.actor.id, exact.identifier, false))
      .issues,
  ).toEqual([]);
  expect(
    (await searchWorkspace(env.DB, f.actor.id, exact.identifier, true))
      .issues[0].id,
  ).toBe(exact.id);
});
