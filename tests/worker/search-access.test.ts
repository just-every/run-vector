import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import {
  getSearchOptions,
  searchWorkspace,
} from "../../src/core/features/search";
import { SearchAccessError } from "../../src/core/features/search/access";
import { testSessionHash as digest, testSessionFence } from "./native-fixture";
import { testCookie } from "./native-fixture";
import {
  beforeSearchRead,
  searchFixture,
  searchId,
  searchNow,
} from "./search-fixture";
let f: Awaited<ReturnType<typeof searchFixture>>;
beforeAll(async () => {
  f = await searchFixture();
});
const find = (q: string, archived = false) =>
  searchWorkspace(env.DB, f.actor.id, q, archived);

it("[SEARCH-001 SEARCH-002 OPS-001] exact and full text use identical team/project archive admission and bounded options exclude archived targets", async () => {
  const project = await f.project("Archivehelium");
  const issue = await f.issue("Archivehydrogen", { project });
  await env.DB.prepare("UPDATE projects SET archived_at=? WHERE id=?")
    .bind(searchNow, project)
    .run();
  for (const q of ["Archivehydrogen", issue.identifier.toLowerCase()]) {
    expect((await find(q)).issues).toEqual([]);
    expect((await find(q, true)).issues[0].id).toBe(issue.id);
  }
  expect((await find("Archivehelium")).projects).toEqual([]);
  expect((await find("Archivehelium", true)).projects[0].id).toBe(project);
  expect(
    (await getSearchOptions(env.DB, f.actor.id)).projects.map((p) => p.id),
  ).not.toContain(project);
  await env.DB.prepare("UPDATE projects SET archived_at=NULL WHERE id=?")
    .bind(project)
    .run();
  await env.DB.prepare("UPDATE teams SET archived_at=? WHERE id=?")
    .bind(searchNow, f.team.id)
    .run();
  try {
    for (const q of ["Archivehydrogen", issue.identifier]) {
      expect((await find(q)).issues).toEqual([]);
      expect((await find(q, true)).issues[0].id).toBe(issue.id);
    }
    const options = await getSearchOptions(env.DB, f.actor.id);
    expect(options.teams.map((t) => t.id)).not.toContain(f.team.id);
    expect(options.statuses.map((s) => s.teamId)).not.toContain(f.team.id);
    expect(options.cycles.map((c) => c.teamId)).not.toContain(f.team.id);
  } finally {
    await env.DB.prepare("UPDATE teams SET archived_at=NULL WHERE id=?")
      .bind(f.team.id)
      .run();
  }
});

it("[SEARCH-001 SEARCH-003 VIEW-002 OPS-001] view create/rename/privacy/delete and foreign workspace records are fenced in all results and options", async () => {
  const other = searchId(),
    foreign = searchId();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    ).bind(
      other,
      f.actor.workspace_id,
      "Other",
      other + "@search.test",
      searchNow,
      searchNow,
    ),
    env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)").bind(
      foreign,
      "Foreign",
      "UTC",
      searchNow,
      searchNow,
    ),
  ]);
  const privateView = await f.view("Viewplatinum", other);
  const sharedView = await f.view("Viewpalladium", other, true);
  expect((await find("Viewplatinum")).savedViews).toEqual([]);
  expect((await find("Viewpalladium")).savedViews[0]).toEqual({
    id: sharedView,
    name: "Viewpalladium",
    isShared: true,
  });
  let options = await getSearchOptions(env.DB, f.actor.id);
  expect(options.savedViews.map((v) => v.id)).not.toContain(privateView);
  expect(options.savedViews.map((v) => v.id)).toContain(sharedView);
  await env.DB.prepare(
    "UPDATE saved_views SET name='Viewrhodium',is_shared=0 WHERE id=?",
  )
    .bind(sharedView)
    .run();
  expect((await find("Viewpalladium")).savedViews).toEqual([]);
  expect((await find("Viewrhodium")).savedViews).toEqual([]);
  await env.DB.prepare("UPDATE saved_views SET owner_operator_id=? WHERE id=?")
    .bind(f.actor.id, sharedView)
    .run();
  expect((await find("Viewrhodium")).savedViews[0].id).toBe(sharedView);
  await env.DB.prepare("DELETE FROM saved_views WHERE id=?")
    .bind(sharedView)
    .run();
  expect((await find("Viewrhodium")).savedViews).toEqual([]);
  // Move a fully populated real team graph into a second workspace. Primary
  // joins must fence even retained FTS records and existing mixed references.
  const project = await f.project("Foreignzirconium");
  const issue = await f.issue("Foreignzirconium", { project });
  const view = await f.view("Foreignzirconium", f.actor.id, true);
  await env.DB.batch([
    env.DB.prepare("UPDATE teams SET workspace_id=? WHERE id=?").bind(
      foreign,
      f.team.id,
    ),
    env.DB.prepare("UPDATE projects SET workspace_id=? WHERE id=?").bind(
      foreign,
      project,
    ),
    env.DB.prepare("UPDATE saved_views SET workspace_id=? WHERE id=?").bind(
      foreign,
      view,
    ),
  ]);
  try {
    expect(await find("Foreignzirconium", true)).toEqual({
      issues: [],
      projects: [],
      savedViews: [],
    });
    expect((await find(issue.identifier, true)).issues).toEqual([]);
    options = await getSearchOptions(env.DB, f.actor.id);
    expect(options.teams.map((t) => t.id)).not.toContain(f.team.id);
    expect(options.statuses.map((s) => s.teamId)).not.toContain(f.team.id);
    expect(options.projects.map((p) => p.id)).not.toContain(project);
    expect(options.savedViews.map((v) => v.id)).not.toContain(view);
  } finally {
    await env.DB.prepare("UPDATE teams SET workspace_id=? WHERE id=?")
      .bind(f.actor.workspace_id, f.team.id)
      .run();
  }
});

it("[SEARCH-001 OPS-001 VIEW-002] final SQL snapshot fences removal, workspace changes, private views and revoked native sessions", async () => {
  const issue = await f.issue("Racetitanium"),
    view = await f.view("Racetitanium", f.actor.id, true);
  const other = searchId();
  await env.DB.prepare(
    "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  )
    .bind(
      other,
      f.actor.workspace_id,
      "Race other",
      other + "@search.test",
      searchNow,
      searchNow,
    )
    .run();
  const changeAtRead = (change: () => Promise<unknown>) => {
    let fired = false;
    return beforeSearchRead(async (sql) => {
      if (!fired && sql.includes("json_group_array")) {
        fired = true;
        await change();
      }
    });
  };
  const db = changeAtRead(() =>
    env.DB.prepare(
      "UPDATE saved_views SET owner_operator_id=?,is_shared=0 WHERE id=?",
    )
      .bind(other, view)
      .run(),
  );
  expect(
    (await searchWorkspace(db, f.actor.id, "Racetitanium", false)).savedViews,
  ).toEqual([]);
  for (const read of [
    (binding: D1Database) =>
      searchWorkspace(binding, f.actor.id, "Racetitanium", false),
    (binding: D1Database) => getSearchOptions(binding, f.actor.id),
  ]) {
    await expect(
      read(
        changeAtRead(() =>
          env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
            .bind(searchNow, f.actor.id)
            .run(),
        ),
      ),
    ).rejects.toBeInstanceOf(SearchAccessError);
    await env.DB.prepare("UPDATE operators SET removed_at=NULL WHERE id=?")
      .bind(f.actor.id)
      .run();
  }
  const workspace = searchId();
  await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)")
    .bind(workspace, "Race workspace", "UTC", searchNow, searchNow)
    .run();
  for (const read of [
    (binding: D1Database) =>
      searchWorkspace(binding, f.actor.id, "Racetitanium", false),
    (binding: D1Database) => getSearchOptions(binding, f.actor.id),
  ]) {
    await expect(
      read(
        changeAtRead(() =>
          env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
            .bind(workspace, f.actor.id)
            .run(),
        ),
      ),
    ).rejects.toBeInstanceOf(SearchAccessError);
    await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
      .bind(f.actor.workspace_id, f.actor.id)
      .run();
  }
  const cookie = await testCookie(env.DB, f.actor.id),
    token = cookie.split("=")[1],
    hash = await digest(token);
  for (const exact of [false, true]) {
    await env.DB.prepare(
      "UPDATE oa_sessions SET revoked_at=NULL WHERE token_hash=?",
    )
      .bind(hash)
      .run();
    let fired = false;
    const revoked = beforeSearchRead(async (sql) => {
      if (
        !fired &&
        sql.includes(
          exact ? "JOIN issues i ON i.identifier" : "json_group_array",
        )
      ) {
        fired = true;
        await env.DB.prepare(
          "UPDATE oa_sessions SET revoked_at=? WHERE token_hash=?",
        )
          .bind(Date.parse(searchNow), hash)
          .run();
      }
    });
    await expect(
      searchWorkspace(
        revoked,
        f.actor.id,
        exact ? issue.identifier : "Racetitanium",
        false,
        await testSessionFence(env.DB,cookie),
      ),
    ).rejects.toBeInstanceOf(SearchAccessError);
  }
  await env.DB.prepare(
    "UPDATE oa_sessions SET revoked_at=NULL WHERE token_hash=?",
  )
    .bind(hash)
    .run();
  await expect(
    getSearchOptions(
      changeAtRead(() =>
        env.DB.prepare(
          "UPDATE oa_sessions SET revoked_at=? WHERE token_hash=?",
        )
          .bind(Date.parse(searchNow), hash)
          .run(),
      ),
      f.actor.id,
      await testSessionFence(env.DB,cookie),
    ),
  ).rejects.toBeInstanceOf(SearchAccessError);
});
