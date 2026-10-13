import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject, it } from "vitest";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import {
  searchWorkspace,
  getSearchOptions,
} from "../../src/core/features/search";

it("[SEARCH-001 SEARCH-003 VIEW-002 VIEW-003 BASE-OPS-002] populated 0014 transition preserves old data and backfills prior comments, labels, evidence, projects and views", async () => {
  const migrations = inject("migrations");
  await applyD1Migrations(env.DB, migrations.slice(0, 2));
  await ensureSampleData(env.DB, new Date("2026-08-31T12:00:00Z"));
  // Populate collaboration-era source before 0014, then retain it through
  // the historical 0015/0016 proof and the current stable-ID head.
  await applyD1Migrations(env.DB, migrations.slice(2, 13));
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) SELECT 'pre14-search-comment',i.id,o.id,'Precollaborationosmium','2026-08-31','2026-08-31' FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id LIMIT 1",
    ),
    env.DB.prepare(
      "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,created_at,updated_at) SELECT 'pre14-search-view',workspace_id,id,'Precollaborationrhenium','issues','2026-08-31','2026-08-31' FROM operators LIMIT 1",
    ),
    env.DB.prepare(
      "INSERT INTO list_preferences(id,operator_id,surface,filters_json,sort,grouping,created_at,updated_at) SELECT 'pre14-search-pref',id,'projects','{}','oldest','none','2026-08-31','2026-08-31' FROM operators LIMIT 1",
    ),
  ]);
  await applyD1Migrations(env.DB, migrations.slice(2, 14));
  const actor = (await env.DB.prepare(
    "SELECT id,workspace_id FROM operators WHERE removed_at IS NULL LIMIT 1",
  ).first<{ id: string; workspace_id: string }>())!;
  const issue = (await env.DB.prepare(
    "SELECT id,identifier FROM issues LIMIT 1",
  ).first<{ id: string; identifier: string }>())!;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES('prior-search-comment',?,?,'Priorcommentosmium','2026-08-31','2026-08-31')",
    ).bind(issue.id, actor.id),
    env.DB.prepare(
      "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,deleted_at,created_at,updated_at) VALUES('prior-search-tombstone',?,?,'Neverindexiridium','2026-08-31','2026-08-31','2026-08-31')",
    ).bind(issue.id, actor.id),
    env.DB.prepare(
      "INSERT INTO labels(id,workspace_id,name,color,created_at,updated_at) VALUES('prior-search-label',?,'Priorlabelruthenium','#aabbcc','2026-08-31','2026-08-31')",
    ).bind(actor.workspace_id),
    env.DB.prepare(
      "INSERT INTO issue_labels VALUES(?,'prior-search-label','2026-08-31')",
    ).bind(issue.id),
    env.DB.prepare(
      "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,filters_json,sort,grouping,created_at,updated_at) VALUES('prior-search-view',?,?,'Priorviewrhenium','issues','{\"label\":\"prior-search-label\"}','oldest','team','2026-08-31','2026-08-31')",
    ).bind(actor.workspace_id, actor.id),
    env.DB.prepare(
      "INSERT INTO list_preferences(id,operator_id,surface,filters_json,sort,grouping,created_at,updated_at) VALUES('prior-search-pref',?,'issues','{\"priority\":\"urgent\"}','priority','team','2026-08-31','2026-08-31')",
    ).bind(actor.id),
  ]);
  const tables = (
    await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name",
    ).all<{ name: string }>()
  ).results;
  const before = await Promise.all(
    tables.map(async ({ name }) => ({
      name,
      columns: (
        await env.DB.prepare(`PRAGMA table_info("${name}")`).all<{
          name: string;
        }>()
      ).results.map((c) => c.name),
      rows: (
        await env.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()
      ).results,
    })),
  );
  const forward = migrations.filter((m) => /^001[56]_/.test(m.name));
  expect(forward).toHaveLength(2);
  await applyD1Migrations(env.DB, forward);
  await applyD1Migrations(env.DB, forward);
  for (const table of before)
    expect(
      (
        await env.DB.prepare(
          `SELECT ${table.columns.map((c) => '"' + c + '"').join(",")} FROM "${table.name}" ORDER BY rowid`,
        ).all()
      ).results,
      table.name,
    ).toEqual(table.rows);
  // The assertions above remain the fixed two-migration historical proof.
  // Current application reads require the appended stable-ID schema.
  await applyD1Migrations(
    env.DB,
    migrations.filter((m) => /^001[78]_/.test(m.name)),
  );
  for (const table of before)
    expect(
      (
        await env.DB.prepare(
          `SELECT ${table.columns.map((c) => '"' + c + '"').join(",")} FROM "${table.name}" ORDER BY rowid`,
        ).all()
      ).results,
      table.name,
    ).toEqual(table.rows);
  // Current search also finds imported issues by source ID, which reads 0025's provenance.
  await applyD1Migrations(env.DB, migrations.filter((m) => m.name === "0025_import_kit.sql"));
  const find = (q: string) => searchWorkspace(env.DB, actor.id, q, true);
  expect((await find("Precollaborationosmium")).issues).toHaveLength(1);
  expect((await find("Precollaborationrhenium")).savedViews[0].id).toBe(
    "pre14-search-view",
  );
  for (const q of ["Priorcommentosmium", "Priorlabelruthenium"])
    expect((await find(q)).issues.map((i) => i.id)).toContain(issue.id);
  expect((await find("Neverindexiridium")).issues).toEqual([]);
  expect((await find("Priorviewrhenium")).savedViews[0].id).toBe(
    "prior-search-view",
  );
  expect(
    (await getSearchOptions(env.DB, actor.id)).savedViews.map((v) => v.id),
  ).toContain("prior-search-view");
  expect(
    await env.DB.prepare("SELECT count(*) n FROM search_issues").first("n"),
  ).toBe(await env.DB.prepare("SELECT count(*) n FROM issues").first("n"));
  expect(
    await env.DB.prepare("SELECT count(*) n FROM search_projects").first("n"),
  ).toBe(await env.DB.prepare("SELECT count(*) n FROM projects").first("n"));
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
});
