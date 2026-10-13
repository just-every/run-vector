import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { inject, it, expect } from "vitest";
import { contractWith } from "../contract-tags";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
contractWith(
  it,
  "REL-006 ISSUE-010 VIEW-004",
  "populated prior schema upgrades without changing views, preferences, comments, labels or any historical column",
  async () => {
    const migrations = inject("migrations");
    await applyD1Migrations(env.DB, migrations.slice(0, 14));
    await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00Z"));
    await env.DB.prepare(
      "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES('parent-upgrade-comment',?,?,'Retained comment','2026-09-30','2026-09-30')",
    )
      .bind(ids.flw842, ids.sarah)
      .run();
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
        ).results.map((row) => row.name),
        rows: (
          await env.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()
        ).results,
      })),
    );
    const migration = migrations.find(
      (m) => m.name === "0015_issue_parents.sql",
    )!;
    expect(migrations.indexOf(migration)).toBe(14);
    await applyD1Migrations(env.DB, [migration]);
    await applyD1Migrations(env.DB, [migration]);
    for (const table of before)
      expect(
        (
          await env.DB.prepare(
            `SELECT ${table.columns.map((c) => '"' + c + '"').join(",")} FROM "${table.name}" ORDER BY rowid`,
          ).all()
        ).results,
        table.name,
      ).toEqual(table.rows);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM issue_parents",
      ).first("n"),
    ).toBe(0);
    for (const table of [
      "saved_views",
      "list_preferences",
      "issue_comments",
      "issue_labels",
    ])
      expect(
        before.find((row) => row.name === table)!.rows.length,
        table,
      ).toBeGreaterThan(0);
  },
);
