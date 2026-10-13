import { historicalAuth } from './historical-auth-fixture';
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject, it } from "vitest";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { bindings, request } from "./base-auth-fixture";
import { contractWith } from "../contract-tags";
contractWith(
  it,
  "BASE-OPS-002 TEAM-001",
  "populated previous-head administration upgrade preserves all original columns and supports code rollback",
  async () => {
    const migrations = inject("migrations"),
      migration = migrations.find(
        (m) => m.name === "0013_workspace_administration.sql",
      )!;
    await applyD1Migrations(env.DB, migrations.slice(0, 2));
    await ensureSampleData(env.DB, new Date("2026-08-31T12:00:00.000Z"));
    await applyD1Migrations(env.DB, migrations.slice(2, migrations.indexOf(migration)));
    await env.DB.prepare(
      "INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at) SELECT '01J00000000000000000000999',id,'Legacy prefix','A1',created_at,updated_at FROM workspace_settings LIMIT 1",
    ).run();
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
      (await env.DB.prepare(
        "SELECT count(*) n FROM team_issue_history",
      ).first())!.n,
    ).toBeGreaterThan(0);
    const team = await env.DB.prepare(
      "SELECT team_id FROM team_issue_history LIMIT 1",
    ).first<{ team_id: string }>();
    await expect(
      env.DB.prepare("UPDATE teams SET identifier_prefix='NEW' WHERE id=?")
        .bind(team!.team_id)
        .run(),
    ).rejects.toThrow(/team_prefix_frozen/);
    const owner = await env.DB.prepare(
      "SELECT email FROM oa_operators WHERE status='active' ORDER BY id LIMIT 1",
    ).first<{ email: string }>();
    await bootstrapWorkspace(env.DB, {
      ...bindings,
      FIRST_OWNER_EMAIL: owner!.email,
    });
    const {cookie} = await historicalAuth(owner!.email);
    // Current HTTP handlers run only after the complete forward schema. The
    // old-column equality and historical prefix guard were checked above.
    await applyD1Migrations(env.DB,migrations.slice(migrations.indexOf(migration) + 1));
    expect(
      (
        await request(
          "/api/settings/teams/01J00000000000000000000999",
          "PATCH",
          { name: "Legacy renamed", archived: true },
          cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "/api/settings/teams/01J00000000000000000000999",
          "PATCH",
          { identifierPrefix: "B2" },
          cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "/api/settings/teams/01J00000000000000000000999",
          "PATCH",
          { identifierPrefix: "VALID", archived: false },
          cookie,
        )
      ).status,
    ).toBe(200);
    // Old application SQL continues to work with additive columns and triggers retained.
    await env.DB.prepare("UPDATE teams SET name=name||' renamed' WHERE id=?")
      .bind(team!.team_id)
      .run();
    const snapshot = (
      await env.DB.prepare(
        "SELECT * FROM team_issue_history ORDER BY team_id",
      ).all()
    ).results;
    await expect(
      env.DB.batch([
        env.DB.prepare(
          "UPDATE teams SET name='Rollback attempt' WHERE id=?",
        ).bind(team!.team_id),
        env.DB.prepare(
          "UPDATE teams SET identifier_prefix='CHANGED' WHERE id=?",
        ).bind(team!.team_id),
      ]),
    ).rejects.toThrow(/team_prefix_frozen/);
    expect(
      (
        await env.DB.prepare(
          "SELECT * FROM team_issue_history ORDER BY team_id",
        ).all()
      ).results,
    ).toEqual(snapshot);
    expect(
      (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
  },
);
