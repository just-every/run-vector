import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject } from "vitest";
import { insertHistoricalSample } from "./historical-sample-fixture";
import { validateArchiveInventory } from "../../src/core/features/data/archive-inventory.mjs";

export async function proveDueRuleUpgrade() {
  const db = env.ARCHIVE_TARGET_DB,
    migrations = inject("migrations");
  const boundary = migrations.findIndex(
    (m) => m.name === "0121_workspace_due_rules.sql",
  );
  await applyD1Migrations(db, migrations.slice(0, boundary));
  await insertHistoricalSample(db, new Date("2026-10-01T00:00:00Z"));
  const tables = (
    await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name",
      )
      .all<{ name: string }>()
  ).results;
  const read = async (name: string) => {
    const columns = (
      await db
        .prepare('PRAGMA table_info("' + name + '")')
        .all<{ name: string }>()
    ).results
      .map((c) => '"' + c.name + '"')
      .join(",");
    return (
      await db
        .prepare(
          "SELECT " + columns + ' FROM "' + name + '" ORDER BY ' + columns,
        )
        .all()
    ).results;
  };
  const before = await Promise.all(
    tables.map(async ({ name }) => ({ name, rows: await read(name) })),
  );
  expect(before.find((x) => x.name === "issues")!.rows.length).toBeGreaterThan(
    0,
  );
  const schema = (
    await db
      .prepare(
        "SELECT name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name",
      )
      .all()
  ).results;
  await applyD1Migrations(db, migrations.slice(boundary));
  for (const { name, rows } of before)
    expect(await read(name), name).toEqual(rows);
  for (const object of schema)
    expect(
      await db
        .prepare("SELECT sql FROM sqlite_master WHERE name=?")
        .bind(object.name)
        .first("sql"),
    ).toBe(object.sql);
  expect(await validateArchiveInventory(db)).toBeGreaterThan(tables.length);
  expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual(
    [],
  );
}
