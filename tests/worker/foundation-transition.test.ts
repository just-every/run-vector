import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject, it } from "vitest";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { removeOperator } from "../../src/core/features/settings/removal";

it("[BASE-OPS-002 OPS-002] expands the previous release without rewriting stored data or guessing a setup owner", async () => {
  const migrations = inject("migrations");
  await applyD1Migrations(env.DB, migrations.slice(0, 9));
  await ensureSampleData(env.DB, new Date("2026-10-01T12:00:00Z"));
  const tables = [
    "operators",
    "operator_sessions",
    "teams",
    "workflow_statuses",
    "issues",
    "evidence_revisions",
    "intake_decisions",
    "issue_activity",
    "team_issue_sequences",
    "projects",
    "cycles",
  ];
  const columns = await Promise.all(tables.map(async (table) =>
    (await env.DB.prepare(`PRAGMA table_info("${table}")`).all<{ name: string }>())
      .results.map(({ name }) => `"${name}"`).join(","),
  ));
  // Compare every pre-existing column; additive migrations may introduce new ones.
  const readOriginalData = () => Promise.all(tables.map((table, index) =>
    env.DB.prepare(`SELECT ${columns[index]} FROM "${table}" ORDER BY ${columns[index]}`)
      .all().then(({ results }) => results),
  ));
  const before = await readOriginalData();
  const workspaceBefore = await env.DB.prepare(
    "SELECT * FROM workspace_settings ORDER BY id",
  ).all().then(({ results }) => results);
  await applyD1Migrations(env.DB, migrations.slice(9));
  expect(await readOriginalData()).toEqual(before);
  expect((await env.DB.prepare(
    "SELECT count(*) AS n FROM evidence_revisions WHERE source_id IS NOT NULL OR source_record_id IS NOT NULL OR source_revision_id IS NOT NULL",
  ).first())?.n).toBe(0);
  const workspaceAfter = await env.DB.prepare(
    "SELECT * FROM workspace_settings ORDER BY id",
  ).all().then(({ results }) => results);
  expect(workspaceAfter.map(({ reminder_time, ...original }) => {
    expect(reminder_time).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
    return original;
  })).toEqual(workspaceBefore);
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM workspace_installation",
      ).first()
    )?.n,
  ).toBe(0);
  await expect(
    removeOperator(env.DB, ids.sarah, ids.maya),
  ).rejects.toMatchObject({ code: "setup_owner_unknown" });
  await bootstrapWorkspace(env.DB, {
    FIRST_OWNER_EMAIL: "sarah@vector.test",
    FIRST_OWNER_NAME: "Not a rewrite",
    WORKSPACE_NAME: "Not a rewrite",
    WORKSPACE_TIMEZONE: "UTC",
    DEFAULT_TEAM_NAME: "Not a rewrite",
    DEFAULT_TEAM_PREFIX: "ZZ",
  });
  expect(
    await env.DB.prepare("SELECT * FROM workspace_settings ORDER BY id")
      .all().then(({ results }) => results),
  ).toEqual(workspaceAfter);
  expect(
    (
      await env.DB.prepare(
        "SELECT setup_operator_id FROM workspace_installation",
      ).first()
    )?.setup_operator_id,
  ).toBe(ids.sarah);
  expect(await readOriginalData()).toEqual(before);
});
