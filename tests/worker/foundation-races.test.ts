import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject, it } from "vitest";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { removeOperator } from "../../src/core/features/settings/removal";
import { createUlid } from "../../src/core/shared/ids";
it("[TEAM-002 OPS-002] simultaneous first requests provision a single complete workspace and reject invalid inputs atomically", async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  const config = {
    FIRST_OWNER_EMAIL: "install@foundation.test",
    FIRST_OWNER_NAME: "Installer",
    WORKSPACE_NAME: "Empty workspace",
    WORKSPACE_TIMEZONE: "UTC",
    DEFAULT_TEAM_NAME: "Delivery",
    DEFAULT_TEAM_PREFIX: "DLV",
  };
  await expect(
    bootstrapWorkspace(env.DB, {
      ...config,
      WORKSPACE_TIMEZONE: "Missing/Zone",
    }),
  ).rejects.toThrow();
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM workspace_settings",
      ).first()
    )?.n,
  ).toBe(0);
  await Promise.all([
    bootstrapWorkspace(env.DB, config),
    bootstrapWorkspace(env.DB, config),
  ]);
  for (const table of [
    "workspace_settings",
    "operators",
    "teams",
    "workspace_bootstrap",
  ])
    expect(
      (await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first())?.n,
    ).toBe(1);
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM workflow_statuses",
      ).first()
    )?.n,
  ).toBe(7);
  expect(
    (await env.DB.prepare("SELECT count(*) AS n FROM issues").first())?.n,
  ).toBe(0);
});

it("[OPS-004] concurrent self-removal cannot empty the workspace", async () => {
  const owner = (await env.DB.prepare("SELECT id FROM operators").first<{
    id: string;
  }>())!.id;
  const workspace = (await env.DB.prepare(
    "SELECT id FROM workspace_settings",
  ).first<{ id: string }>())!.id;
  const second = createUlid(new Date()),
    at = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  )
    .bind(second, workspace, "Second", "second@foundation.test", at, at)
    .run();
  const results = await Promise.allSettled([
    removeOperator(env.DB, owner, owner),
    removeOperator(env.DB, second, second),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM operators WHERE removed_at IS NULL",
      ).first()
    )?.n,
  ).toBe(1);
});
