import { historicalAuth } from './historical-auth-fixture';
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject, it } from "vitest";
import { contractWith } from "../contract-tags";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { bindings, request, signIn, mailToken } from "./base-auth-fixture";
contractWith(
  it,
  "BASE-OPS-002 BASE-DATA-003 NOTIFY-002 ISSUE-010",
  "populated immediate 0013 to 0014 preserves every old column, backfills only recoverable relationships and keeps additive rollback state",
  async () => {
    const migrations = inject("migrations"),
      next = migrations.find((m) => m.name === "0014_collaboration.sql")!;
    await applyD1Migrations(env.DB, migrations.slice(0, 2));
    await ensureSampleData(env.DB, new Date("2026-08-31T12:00:00.000Z"));
    await applyD1Migrations(env.DB, migrations.slice(2, migrations.indexOf(next)));
    const owner = await env.DB.prepare(
      "SELECT email FROM oa_operators WHERE status='active' ORDER BY id LIMIT 1",
    ).first<{ email: string }>();
    await bootstrapWorkspace(env.DB, {
      ...bindings,
      FIRST_OWNER_EMAIL: owner!.email,
    });
    const {cookie,invite} = await historicalAuth(owner!.email);
    await invite('upgrade-pending@collaboration.test');
    // Populate historical administration with the rows a 0013 label creation
    // wrote; today's native mutation adapter requires later migrations.
    const actor = await env.DB.prepare('SELECT m.operator_id,o.workspace_id FROM vector_auth_operators m JOIN oa_operators a ON a.id=m.auth_id JOIN operators o ON o.id=m.operator_id WHERE a.email=?').bind(owner!.email).first<{operator_id:string;workspace_id:string}>();
    const labelAt = '2026-08-31T12:30:00.000Z';
    await env.DB.batch([
      env.DB.prepare('INSERT INTO labels(id,workspace_id,name,color,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('01J00000000000000000000887',actor!.workspace_id,'Upgrade administration','#336699',labelAt,labelAt),
      env.DB.prepare('INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('01J00000000000000000000886',actor!.operator_id,'label.created','Upgrade administration','01J00000000000000000000887',labelAt,labelAt),
      env.DB.prepare('INSERT INTO administration_audit_details(audit_id,previous_value_json,next_value_json) VALUES(?,?,?)').bind('01J00000000000000000000886','null',JSON.stringify({name:'Upgrade administration',color:'#336699'})),
    ]);
    const issue = await env.DB.prepare(
      "SELECT id,assignee_operator_id FROM issues WHERE assignee_operator_id IS NOT NULL LIMIT 1",
    ).first<{ id: string; assignee_operator_id: string }>();
    await env.DB.prepare(
      "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES('01J00000000000000000000888',?,?,'Historical literal @mention','2026-08-31','2026-08-31')",
    )
      .bind(issue!.id, issue!.assignee_operator_id)
      .run();
    const names = (
      await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name",
      ).all<{ name: string }>()
    ).results;
    const before = await Promise.all(
      names.map(async ({ name }) => ({
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
    for (const name of [
      "local_mail_outbox",
      "oa_sessions",
      "oa_tokens",
      "vector_auth_operators",
      "administration_audit_details",
    ])
      expect(
        before.find((t) => t.name === name)!.rows.length,
        name,
      ).toBeGreaterThan(0);
    await applyD1Migrations(env.DB, [next]);
    await applyD1Migrations(env.DB, [next]);
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
      (await env.DB.prepare("SELECT count(*) n FROM issue_followers").first())!
        .n,
    ).toBeGreaterThan(0);
    for (const table of [
      "notifications",
      "notification_deliveries",
      "notification_development_mail",
      "issue_mentions",
    ])
      expect(
        (await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first())!.n,
      ).toBe(0);
    await expect(
      env.DB.prepare("INSERT INTO issue_followers VALUES('missing',?,'now')")
        .bind(issue!.assignee_operator_id)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
    await expect(
      env.DB.prepare("INSERT INTO notification_preferences VALUES(?,2)")
        .bind(issue!.assignee_operator_id)
        .run(),
    ).rejects.toThrow(/CHECK/);
    await env.DB.prepare(
      "DELETE FROM issue_followers WHERE issue_id=? AND operator_id=?",
    )
      .bind(issue!.id, issue!.assignee_operator_id)
      .run();
    await applyD1Migrations(env.DB, [next]);
    expect(
      await env.DB.prepare(
        "SELECT 1 FROM issue_followers WHERE issue_id=? AND operator_id=?",
      )
        .bind(issue!.id, issue!.assignee_operator_id)
        .first(),
    ).toBeNull();
    // Previous application SQL keeps working with schema retained on code rollback.
    await env.DB.prepare("UPDATE issues SET title=title WHERE id=?")
      .bind(issue!.id)
      .run();
    await expect(
      env.DB.batch([
        env.DB.prepare("INSERT INTO notification_preferences VALUES(?,0)").bind(
          issue!.assignee_operator_id,
        ),
        env.DB.prepare("SELECT json('rollback failpoint')"),
      ]),
    ).rejects.toThrow();
    expect(
      await env.DB.prepare("SELECT * FROM notification_preferences").first(),
    ).toBeNull();
    expect(
      (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
    // Current sender behavior is proved after its actual forward schema.
    await applyD1Migrations(env.DB,migrations.slice(migrations.indexOf(next) + 1));
    const freshCookie=await signIn(owner!.email);
    expect((await request('/api/settings/labels','POST',{name:'Current upgrade administration',color:'#336699'},freshCookie)).status).toBe(200);
    expect((await request('/api/settings/operators/invite','POST',{email:'current-upgrade@collaboration.test',displayName:'Pending'},freshCookie)).status).toBe(202);
    await mailToken('current-upgrade@collaboration.test');
  },
);
