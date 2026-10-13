import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { searchWorkspace } from "../../src/core/features/search";
import { searchFixture } from "./search-fixture";

it("[SEARCH-001 SEARCH-003] source rowid changes and FTS rebuild preserve stable issue, project and view identities without orphans", async () => {
  const f = await searchFixture();
  const project = await f.project("Stableprojectniobium"),
    view = await f.view("Stableviewtantalum");
  const first = await f.issue("Stableissuezirconium", { project }),
    second = await f.issue("Otherissuemolybdenum");
  // A restore may assign arbitrary storage rowids to the same TEXT primary IDs.
  // Swap two issue rowids to prove this cannot silently return the wrong issue.
  const rows = (
    await env.DB.prepare("SELECT id,rowid FROM issues WHERE id IN (?,?)")
      .bind(first.id, second.id)
      .all<{ id: string; rowid: number }>()
  ).results;
  const a = rows.find((r) => r.id === first.id)!.rowid,
    b = rows.find((r) => r.id === second.id)!.rowid;
  await env.DB.batch([
    env.DB.prepare("UPDATE issues SET rowid=900001 WHERE id=?").bind(first.id),
    env.DB.prepare("UPDATE issues SET rowid=? WHERE id=?").bind(a, second.id),
    env.DB.prepare("UPDATE issues SET rowid=? WHERE id=?").bind(b, first.id),
    env.DB.prepare("UPDATE projects SET rowid=900002 WHERE id=?").bind(project),
    env.DB.prepare("UPDATE saved_views SET rowid=900003 WHERE id=?").bind(view),
  ]);
  const find = (q: string) => searchWorkspace(env.DB, f.actor.id, q, false);
  expect((await find("Stableissuezirconium")).issues).toEqual([first]);
  expect((await find("Otherissuemolybdenum")).issues).toEqual([second]);
  expect(
    (await find("Stableprojectniobium")).projects.map((p) => p.id),
  ).toEqual([project]);
  expect(
    (await find("Stableviewtantalum")).savedViews.map((v) => v.id),
  ).toEqual([view]);
  for (const name of ["search_issues", "search_projects", "search_views"]) {
    // FTS has its own storage rowids; those must not encode source identity.
    await env.DB.prepare(`UPDATE ${name} SET rowid=rowid+1000000`).run();
    await env.DB.prepare(
      `INSERT INTO ${name}(${name}) VALUES('rebuild')`,
    ).run();
  }
  expect((await find("Stableissuezirconium")).issues).toEqual([first]);
  expect(
    (await find("Stableprojectniobium")).projects.map((p) => p.id),
  ).toEqual([project]);
  expect(
    (await find("Stableviewtantalum")).savedViews.map((v) => v.id),
  ).toEqual([view]);
  await env.DB.prepare(
    "UPDATE issues SET title='Stableissuerenamed' WHERE id=?",
  )
    .bind(first.id)
    .run();
  expect((await find("Stableissuezirconium")).issues).toEqual([]);
  expect((await find("Stableissuerenamed")).issues[0].id).toBe(first.id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issues WHERE id IN (?,?)").bind(
      first.id,
      second.id,
    ),
    env.DB.prepare("DELETE FROM projects WHERE id=?").bind(project),
    env.DB.prepare("DELETE FROM saved_views WHERE id=?").bind(view),
  ]);
  for (const [index, source] of [
    ["search_issues", "issues"],
    ["search_projects", "projects"],
    ["search_views", "saved_views"],
  ]) {
    expect(
      await env.DB.prepare(
        `SELECT count(*) n FROM ${index} f LEFT JOIN ${source} s ON s.id=f.id WHERE s.id IS NULL`,
      ).first("n"),
    ).toBe(0);
    expect(
      await env.DB.prepare(`SELECT count(*) n FROM ${index}`).first("n"),
    ).toBe(await env.DB.prepare(`SELECT count(*) n FROM ${source}`).first("n"));
  }
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
});
