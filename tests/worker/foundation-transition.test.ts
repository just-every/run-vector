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
  const before = await Promise.all(
    tables.map((table) => env.DB.prepare(`SELECT * FROM ${table}`).all()),
  );
  const workspaceBefore = await env.DB.prepare(
    "SELECT * FROM workspace_settings",
  ).first();
  await applyD1Migrations(env.DB, migrations.slice(9));
  expect(
    await Promise.all(
      tables.map((table) =>
        env.DB.prepare(`SELECT * FROM ${table}`)
          .all()
          .then((r) => r.results),
      ),
    ),
  ).toEqual(before.map((r) => r.results));
  const workspaceAfter = await env.DB.prepare(
    "SELECT * FROM workspace_settings",
  ).first();
  expect(workspaceAfter).toEqual(workspaceBefore);
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
    await env.DB.prepare("SELECT * FROM workspace_settings").first(),
  ).toEqual(workspaceBefore);
  expect(
    (
      await env.DB.prepare(
        "SELECT setup_operator_id FROM workspace_installation",
      ).first()
    )?.setup_operator_id,
  ).toBe(ids.sarah);
  expect(
    await Promise.all(
      tables.map((table) =>
        env.DB.prepare(`SELECT * FROM ${table}`)
          .all()
          .then((r) => r.results),
      ),
    ),
  ).toEqual(before.map((r) => r.results));
});
