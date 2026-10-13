import {populateUpgradeHistory} from './upgrade-history';
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { inject, it, expect } from "vitest";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
it("[BASE-DATA-001 BASE-OPS-002] populated previous schema retains every source column and file reservation under additive browsing and cleanup migration", async () => {
  const migrations = inject("migrations");
  await applyD1Migrations(env.DB, migrations.slice(0, 18));
  await ensureSampleData(env.DB, new Date("2026-10-01T00:00:00Z"));
  await env.DB.prepare(
    "INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,writer_settled,created_at,updated_at) VALUES('retained-upload',?,?,'retained','text/plain',4,'retained-key','pending',0,'now','now')",
  )
    .bind(ids.flw842, ids.sarah)
    .run();
  await populateUpgradeHistory();
  const names = (
    await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations'",
    ).all<{ name: string }>()
  ).results;
  const before = await Promise.all(
    names.map(async ({ name }) => ({
      name,
      rows: (await env.DB.prepare(`SELECT * FROM "${name}"`).all()).results,
    })),
  );
  const migration = migrations.find(
    (m) => m.name === "0019_browse_revision_file_custody.sql",
  )!;
  expect(migrations.indexOf(migration)).toBe(18);
  await applyD1Migrations(env.DB, [migration]);
  await applyD1Migrations(env.DB, [migration]);
  for (const table of before)
    expect(
      (await env.DB.prepare(`SELECT * FROM "${table.name}"`).all()).results,
      table.name,
    ).toEqual(table.rows);
  expect(
    await env.DB.prepare("SELECT count(*) n FROM detached_file_removals").first(
      "n",
    ),
  ).toBe(0);
  expect(
    await env.DB.prepare("SELECT revision FROM issue_list_revision").first(
      "revision",
    ),
  ).toBe(0);
  await env.DB.prepare("UPDATE issues SET title=title||' changed' WHERE id=?")
    .bind(ids.flw842)
    .run();
  expect(
    await env.DB.prepare("SELECT revision FROM issue_list_revision").first(
      "revision",
    ),
  ).toBeGreaterThan(0);
});
