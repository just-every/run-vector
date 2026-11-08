import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject } from "vitest";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { createUlid } from "../../src/core/shared/ids";
import { bindings } from "./base-auth-fixture";
/** Populated pre-feature preference rows survive the additive upgrade. */
export async function resolutionSlaUpgrade() {
  const db = (env as unknown as { ARCHIVE_TARGET_DB: D1Database })
    .ARCHIVE_TARGET_DB;
  const migrations = inject("migrations");
  const latest = migrations.filter((m) => m.name >= "0128_resolution_slas.sql");
  await applyD1Migrations(
    db,
    migrations.filter((m) => m.name < "0128_resolution_slas.sql"),
  );
  await bootstrapWorkspace(db, bindings);
  const workspace = (await db
    .prepare("SELECT id FROM workspace_settings")
    .first<{ id: string }>())!.id;
  const id = createUlid(new Date()),
    at = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    )
    .bind(
      id,
      workspace,
      "synthetic-vector-193",
      ["synthetic-vector-193", "vector.test"].join("@"),
      at,
      at,
    )
    .run();
  await db.batch([
    db
      .prepare(
        "INSERT INTO notification_type_mutes(operator_id,kind) VALUES(?,'comment')",
      )
      .bind(id),
    db
      .prepare(
        "INSERT INTO notification_channel_defaults(workspace_id,kind,email_mode,slack_enabled) VALUES(?,'comment','daily',1)",
      )
      .bind(workspace),
    db
      .prepare(
        "INSERT INTO notification_channel_overrides(operator_id,kind,email_mode,slack_enabled) VALUES(?,'comment','hourly',0)",
      )
      .bind(id),
  ]);
  const tables = [
    "notification_type_mutes",
    "notification_channel_defaults",
    "notification_channel_overrides",
  ];
  const rows = async () =>
    Promise.all(
      tables.map(
        async (table) =>
          (await db.prepare("SELECT * FROM " + table + " ORDER BY 1,2").all())
            .results,
      ),
    );
  const before = await rows();
  await applyD1Migrations(db, latest);
  expect(await rows()).toEqual(before);
  await db
    .prepare(
      "INSERT INTO notification_type_mutes(operator_id,kind) VALUES(?,'sla_warning')",
    )
    .bind(id)
    .run();
  expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual(
    [],
  );
  expect(
    (
      await db
        .prepare("SELECT name FROM d1_migrations ORDER BY name")
        .all<{ name: string }>()
    ).results.map((m) => m.name),
  ).toEqual(migrations.map((m) => m.name).sort());
}
