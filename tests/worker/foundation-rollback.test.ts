import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject, it } from "vitest";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { removeOperator } from "../../src/core/features/settings/removal";
import { testCookie } from "./native-fixture";
import { activeSession } from "../../src/core/features/auth/repository";
import { createUlid } from "../../src/core/shared/ids";

it("[OPS-004 BASE-DATA-001] a failed cascade rolls back removal, revocation and all transfers", async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await bootstrapWorkspace(env.DB, {
    FIRST_OWNER_EMAIL: "owner@rollback.test",
    FIRST_OWNER_NAME: "Owner",
    WORKSPACE_NAME: "Rollback",
    WORKSPACE_TIMEZONE: "UTC",
    DEFAULT_TEAM_NAME: "Team",
    DEFAULT_TEAM_PREFIX: "RB",
  });
  const workspace = (await env.DB.prepare(
    "SELECT id FROM workspace_settings",
  ).first<{ id: string }>())!.id;
  const owner = (await env.DB.prepare("SELECT id FROM operators").first<{
    id: string;
  }>())!.id;
  const target = createUlid(new Date()),
    at = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  )
    .bind(target, workspace, "Target", "target@rollback.test", at, at)
    .run();
  const cookie = await testCookie(env.DB, target);
  await env.DB.exec(
    "CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON audit_records WHEN NEW.action='operator.removed' BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END;",
  );
  await expect(removeOperator(env.DB, owner, target)).rejects.toThrow();
  expect(
    (
      await env.DB.prepare("SELECT removed_at FROM operators WHERE id=?")
        .bind(target)
        .first()
    )?.removed_at,
  ).toBeNull();
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM operator_removals",
      ).first()
    )?.n,
  ).toBe(0);
  expect((await activeSession(env.DB, cookie.split("=")[1]))?.id).toBe(target);
  await env.DB.exec("DROP TRIGGER synthetic_audit_failure");
  expect(await removeOperator(env.DB, owner, target)).toMatchObject({
    removed: true,
  });
});
