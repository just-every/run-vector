import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject, it } from "vitest";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { searchWorkspace } from "../../src/core/features/search";

it("[SEARCH-001 SEARCH-003 VIEW-002 VIEW-003 BASE-OPS-002] populated 0017 upgrade rebuilds stable IDs without changing any source records", async () => {
  const migrations = inject("migrations");
  await applyD1Migrations(env.DB, migrations.slice(0, 17));
  await ensureSampleData(env.DB, new Date("2026-08-31T12:00:00Z"));
  const actor = (await env.DB.prepare(
    "SELECT id,workspace_id FROM operators WHERE removed_at IS NULL LIMIT 1",
  ).first<{ id: string; workspace_id: string }>())!;
  const issue = (await env.DB.prepare(
    "SELECT id,identifier FROM issues LIMIT 1",
  ).first<{ id: string; identifier: string }>())!;
  const project = (await env.DB.prepare(
    "SELECT id FROM projects LIMIT 1",
  ).first<{ id: string }>())!;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES('stable-upgrade-comment',?,?,'Upgradecommentchromium','2026-08-31','2026-08-31')",
    ).bind(issue.id, actor.id),
    env.DB.prepare(
      "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,deleted_at,created_at,updated_at) VALUES('stable-upgrade-deleted',?,?,'Upgradedeletedchromium','2026-08-31','2026-08-31','2026-08-31')",
    ).bind(issue.id, actor.id),
    env.DB.prepare(
      "INSERT INTO labels(id,workspace_id,name,color,created_at,updated_at) VALUES('stable-upgrade-label',?,'Upgradelabelchromium','#abcdef','2026-08-31','2026-08-31')",
    ).bind(actor.workspace_id),
    env.DB.prepare(
      "INSERT INTO issue_labels VALUES(?,'stable-upgrade-label','2026-08-31')",
    ).bind(issue.id),
    env.DB.prepare(
      "UPDATE projects SET name='Upgradeprojectchromium' WHERE id=?",
    ).bind(project.id),
    env.DB.prepare(
      "UPDATE issues SET project_id=?,expected_outcome='Upgradeoutcomechromium',customer_impact='Upgradeimpactchromium' WHERE id=?",
    ).bind(project.id, issue.id),
    env.DB.prepare(
      "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,filters_json,sort,grouping,layout,created_at,updated_at) VALUES('stable-upgrade-view',?,?,'Upgradeviewchromium','issues','{\"label\":\"stable-upgrade-label\"}','oldest','team','board','2026-08-31','2026-08-31')",
    ).bind(actor.workspace_id, actor.id),
    env.DB.prepare(
      "INSERT INTO list_preferences(id,operator_id,surface,filters_json,sort,grouping,created_at,updated_at) VALUES('stable-upgrade-pref',?,'issues','{\"priority\":\"urgent\"}','priority','team','2026-08-31','2026-08-31')",
    ).bind(actor.id),
  ]);
  const tables = (
    await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'search_%' AND name!='d1_migrations' ORDER BY name",
    ).all<{ name: string }>()
  ).results;
  const snapshot = () =>
    Promise.all(
      tables.map(async ({ name }) => ({
        name,
        rows: (
          await env.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()
        ).results,
      })),
    );
  const before = await snapshot();
  const forward = migrations.filter(
    (m) => m.name === "0018_stable_search_ids.sql",
  );
  expect(forward).toHaveLength(1);
  await applyD1Migrations(env.DB, forward);
  await applyD1Migrations(env.DB, forward);
  expect(await snapshot()).toEqual(before);
  // Current search also finds imported issues by source ID, which reads 0025's provenance.
  await applyD1Migrations(env.DB, migrations.filter((m) => m.name === "0025_import_kit.sql"));
  const find = (q: string) => searchWorkspace(env.DB, actor.id, q, true);
  for (const token of [
    "Upgradecommentchromium",
    "Upgradelabelchromium",
    "Upgradeprojectchromium",
    "Upgradeoutcomechromium",
    "Upgradeimpactchromium",
  ])
    expect(
      (await find(token)).issues.map((i) => i.id),
      token,
    ).toContain(issue.id);
  expect((await find("Upgradedeletedchromium")).issues).toEqual([]);
  expect((await find("Upgradeviewchromium")).savedViews[0].id).toBe(
    "stable-upgrade-view",
  );
  expect((await find("Upgradeprojectchromium")).projects[0].id).toBe(
    project.id,
  );
  for (const [index, source] of [
    ["search_issues", "issues"],
    ["search_projects", "projects"],
    ["search_views", "saved_views"],
  ]) {
    expect(
      (await env.DB.prepare(`SELECT id FROM ${index} ORDER BY id`).all())
        .results,
    ).toEqual(
      (await env.DB.prepare(`SELECT id FROM ${source} ORDER BY id`).all())
        .results,
    );
    expect(
      await env.DB.prepare(
        `SELECT count(*) n FROM ${index} WHERE typeof(id)!='text'`,
      ).first("n"),
    ).toBe(0);
  }
  const triggers = (
    await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'search_%'",
    ).all<{ sql: string }>()
  ).results;
  expect(triggers.length).toBeGreaterThan(15);
  for (const trigger of triggers) expect(trigger.sql).not.toMatch(/\browid\b/i);
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
});
