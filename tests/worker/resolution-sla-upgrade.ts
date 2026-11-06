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
  const latest = migrations.filter((m) => m.name >= "0126_resolution_slas.sql");
  await applyD1Migrations(
    db,
    migrations.filter((m) => m.name < "0126_resolution_slas.sql"),
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
  await applyD1Migrations(
    db,
    latest.filter((m) => m.name < "0130_sla_team_archive.sql"),
  );
  const archived = await populatedArchiveClock(db, at);
  await applyD1Migrations(
    db,
    latest.filter((m) => m.name >= "0130_sla_team_archive.sql"),
  );
  expect(
    await db
      .prepare("SELECT * FROM issue_sla_clocks WHERE issue_id=?")
      .bind(archived.issue)
      .first(),
  ).toEqual({
    ...archived.clock,
    stopped_at: archived.at,
    stop_reason: "stopped",
    revision: expect.any(String),
  });
  expect(
    (
      await db
        .prepare("SELECT * FROM issue_sla_occurrences WHERE issue_id=?")
        .bind(archived.issue)
        .all()
    ).results,
  ).toEqual(archived.receipts);
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

/** The previous schema could miss an archive between scheduler observations.
 * Upgrade stops its populated clock while retaining the target and receipts. */
async function populatedArchiveClock(db: D1Database, at: string) {
  const team = (await db
    .prepare("SELECT id,identifier_prefix FROM teams LIMIT 1")
    .first<{ id: string; identifier_prefix: string }>())!;
  const status = await db
    .prepare(
      "SELECT id FROM workflow_statuses WHERE team_id=? AND category='unstarted'",
    )
    .bind(team.id)
    .first<string>("id");
  const issue = createUlid(new Date(at));
  await db
    .prepare(
      `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,created_at,updated_at)
    VALUES(?,?,?,1,?,'synthetic-vector-197',?,'urgent',?,?)`,
    )
    .bind(
      issue,
      team.identifier_prefix + "-1",
      team.identifier_prefix,
      team.id,
      status,
      at,
      at,
    )
    .run();
  const rule = JSON.stringify({
    enabled: true,
    priority: "urgent",
    labelId: null,
    targetMinutes: 10,
    warnBeforeMinutes: 5,
    workingDays: [1, 2, 3, 4, 5],
    startsAt: "09:00",
    endsAt: "17:00",
  });
  await db
    .prepare(
      `INSERT INTO issue_sla_clocks(issue_id,team_id,rule_json,timezone,started_at,observed_at,elapsed_minutes,revision)
    VALUES(?,?,?,'UTC',?,?,3,'synthetic-vector-197')`,
    )
    .bind(issue, team.id, rule, at, at)
    .run();
  await db
    .prepare(
      "INSERT INTO issue_sla_occurrences(issue_id,kind,event_id,created_at) VALUES(?,'warning',?,?)",
    )
    .bind(issue, crypto.randomUUID(), at)
    .run();
  const clock = await db
    .prepare("SELECT * FROM issue_sla_clocks WHERE issue_id=?")
    .bind(issue)
    .first();
  const receipts = (
    await db
      .prepare("SELECT * FROM issue_sla_occurrences WHERE issue_id=?")
      .bind(issue)
      .all()
  ).results;
  await db
    .prepare("UPDATE teams SET archived_at=?,updated_at=? WHERE id=?")
    .bind(at, at, team.id)
    .run();
  return { issue, at, clock, receipts };
}
