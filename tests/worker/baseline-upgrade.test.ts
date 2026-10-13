import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject, it } from "vitest";
import { contractWith } from "../contract-tags";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { historySnapshot, tableSnapshot } from "./upgrade-history";
import { sampleOwner, sampleBindings } from "./sample-auth-fixture";
import { applyAuthRuntimeMigrations } from "./populated-upgrade";
import { scheduled } from "../../src/core/app/scheduled";
import { request } from "./base-auth-fixture";
import { validateArchiveInventory } from "../../src/core/features/data/archive-inventory.mjs";
import { d1RetirementSchema } from "../../vendor/base/import-kit/src/d1/index";
import { integrationOwner } from '../../src/core/features/integrations/authority';
import { ownerTokens } from '../../src/core/features/integrations/tokens';
contractWith(
  it,
  "CYCLE-004 CYCLE-005 ISSUE-007 ISSUE-010 ISSUE-011 REL-003 REL-004 REL-005 OPS-003 NOTIFY-005",
  "populated previous schema preserves old rows indexes and triggers with declared source identity key expansion across the baseline upgrade",
  async () => {
    const migrations = inject("migrations"),
      boundary = migrations.findIndex(
        (m) => m.name === "0031_cycle_closure.sql",
      );
    await applyD1Migrations(env.DB, migrations.slice(0, 2));
    await ensureSampleData(env.DB, new Date("2026-10-01T00:00:00Z"));
    await applyD1Migrations(env.DB, migrations.slice(2, boundary));
    const at = "2026-09-01T00:00:00.000Z";
    const cycle = (
      id: string,
      team: string,
      name: string,
      start: string,
      end: string,
    ) =>
      env.DB.prepare(
        "INSERT INTO cycles(id,team_id,name,starts_at,ends_at,capacity,created_at,updated_at) VALUES(?,?,?,?,?,20,?,?)",
      ).bind(id, team, name, start, end, at, at);
    await env.DB.batch([
      cycle(
        "upgrade-ended",
        ids.flow,
        "Ended with next",
        "2026-08-01T00:00:00Z",
        "2026-08-08T00:00:00Z",
      ),
      cycle(
        "upgrade-next",
        ids.flow,
        "Next already started",
        "2026-08-08T00:00:00Z",
        "2026-08-15T00:00:00Z",
      ),
      cycle(
        "upgrade-no-next",
        ids.platform,
        "Ended without next",
        "2026-10-05T00:00:00Z",
        "2026-10-06T00:00:00Z",
      ),
      env.DB.prepare(
        "UPDATE issues SET cycle_id='upgrade-ended',estimate=7,due_date='2026-09-07' WHERE id=?",
      ).bind(ids.flw842),
      env.DB.prepare(
        "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      ).bind(
        "upgrade-comment",
        ids.flw842,
        ids.sarah,
        "Retained discussion",
        at,
        at,
      ),
      env.DB.prepare(
        "INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,writer_settled,created_at,updated_at) VALUES(?,?,?,'proof.bin','application/octet-stream',4,'baseline-upgrade-file','ready',1,?,?)",
      ).bind("upgrade-file", ids.flw842, ids.sarah, at, at),
      env.DB.prepare(
        'UPDATE evidence_revisions SET customer_reports_json=\'[{"customer":"synthetic upgrade customer","summary":"Retained report"}]\' WHERE issue_id=?',
      ).bind(ids.flw842),
    ]);
    await env.FILES.put(
      "baseline-upgrade-file",
      new Uint8Array([0, 1, 2, 255]),
    );
    // Base's sign-in reads its dev-session and identity ledgers first.
    await applyAuthRuntimeMigrations(env.DB);
    const cookie = await sampleOwner();
    // Seed the previous schema through its native token service. The current
    // HTTP mutation adapter requires the new restore-reservation migration.
    const owner=await integrationOwner(sampleBindings,new Request(sampleBindings.APP_ORIGIN+'/api/settings/integrations/tokens',{headers:{host:new URL(sampleBindings.APP_ORIGIN).host,cookie}}));
    await ownerTokens(env.DB,owner).issue(owner,{name:'Upgrade token',scopes:['issues:read']});
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO vector_source_records(source_id,record_id,issue_id,created_at) VALUES(?,?,?,?)",
      ).bind("upgrade-source", "old-record", ids.flw842, at),
      env.DB.prepare(
        "INSERT INTO vector_source_receipts(source_id,record_id,revision_id,payload_hash,issue_id,evidence_id,received_at) VALUES(?,?,?,?,?,?,?)",
      ).bind(
        "upgrade-source",
        "old-record",
        "old-revision",
        "old-payload-hash",
        ids.flw842,
        "old-evidence",
        at,
      ),
    ]);
    await env.DB.prepare(
      "INSERT INTO notification_type_mutes(operator_id,kind) VALUES(?,'comment')",
    )
      .bind(ids.sarah)
      .run();
    const before = await historySnapshot();
    for (const table of [
      "issues",
      "cycles",
      "issue_comments",
      "issue_files",
      "evidence_revisions",
      "operators",
      "oa_sessions",
      "oa_tokens",
      "integration_tokens",
      "vector_source_records",
      "vector_source_receipts",
    ])
      expect(
        before.find((t) => t.name === table)!.rows.length,
        table,
      ).toBeGreaterThan(0);
    const master = (
      await env.DB.prepare(
        "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name",
      ).all()
    ).results;
    const oldSourceColumns = Object.fromEntries(
      await Promise.all(
        ["vector_source_records", "vector_source_receipts"].map(
          async (table) => [
            table,
            (await env.DB.prepare("PRAGMA table_info(" + table + ")").all())
              .results,
          ],
        ),
      ),
    );
    await applyD1Migrations(env.DB, migrations.slice(boundary));
    const sourceIdentityTables = new Set([
      "vector_source_records",
      "vector_source_receipts",
    ]);
    for (const row of master) {
      if (row.type === "table" && sourceIdentityTables.has(String(row.name))) {
        const columns = (
          await env.DB.prepare('PRAGMA table_info("' + row.name + '")').all<{
            name: string;
          }>()
        ).results;
        const sourceSql = await env.DB.prepare(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        )
          .bind(row.name)
          .first<string>("sql");
        // 0033 deliberately expands only the PK with the live/erased domain.
        // Compare the rest of the original table definition and every old row.
        const normalize = (sql: string) =>
          sql.replaceAll('"', "").replace(/\s+/g, "");
        expect(
          normalize(
            sourceSql!
              .replace(
                /erased INTEGER NOT NULL DEFAULT 0 CHECK\(erased IN\(0,1\)\),\s*/,
                "",
              )
              .replace(/,erased\)/, ")"),
          ),
        ).toBe(normalize(String(row.sql)));
        expect(columns.slice(0, -1)).toEqual(
          oldSourceColumns[String(row.name)],
        );
        expect(columns.at(-1)).toMatchObject({
          name: "erased",
          type: "INTEGER",
          notnull: 1,
          dflt_value: "0",
          pk: row.name === "vector_source_records" ? 3 : 4,
        });
        continue;
      }
      // 0035 replaces the one-batch import triggers with the staged batch-boundary rule.
      if (row.type === "trigger" && ["vector_import_whole_apply", "vector_import_whole_reversal"].includes(row.name as string)) {
        expect(await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?").bind(row.name).first()).toBeNull();
        expect(await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='vector_import_staged_apply'").first()).not.toBeNull();
        continue;
      }
      // 0037 adds one nullable column for imported comment authors; nothing else changes.
      if (row.type === "table" && row.name === "issue_comments") {
        const current = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='issue_comments'").first<{ sql: string }>();
        expect(current!.sql).toBe(String(row.sql).replace(/\)$/, ", imported_author_name TEXT CHECK(imported_author_name IS NULL OR length(imported_author_name) BETWEEN 1 AND 200))"));
        expect((await env.DB.prepare("SELECT count(*) AS n FROM issue_comments WHERE imported_author_name IS NOT NULL").first<number>("n"))).toBe(0);
        continue;
      }
      // 0043 (Base d1RetirementSchema) replaces the stream revision trigger with one that admits retirement.
      if (row.type === "trigger" && row.name === "ik_d1_stream_revision_update") {
        const current = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name=?").bind(row.name).first<{ sql: string }>();
        expect(d1RetirementSchema).toContain(current!.sql);
        continue;
      }
      // The two reminder schema changes are compared explicitly below.
      if (
        row.type === "table" &&
        ["workspace_settings", "notification_type_mutes"].includes(
          row.name as string,
        )
      )
        continue;
      expect(
        await env.DB.prepare(
          "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type=? AND name=?",
        )
          .bind(row.type, row.name)
          .first(),
        row.name as string,
      ).toEqual(row);
    }
    const priorWorkspace = master.find((r) => r.name === "workspace_settings")!;
    const workspaceSql = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE name='workspace_settings'",
    ).first<string>("sql");
    expect(
      workspaceSql!.replace(
        /, reminder_time TEXT NOT NULL DEFAULT '09:00'[\s\S]*?\);?$/,
        ")",
      ),
    ).toBe(priorWorkspace.sql);
    const muteSql = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE name='notification_type_mutes'",
    ).first<string>("sql");
    expect(muteSql!.replace(",'due_reminder'", "")).toBe(
      master.find((r) => r.name === "notification_type_mutes")!.sql,
    );
    expect(
      (
        await env.DB.prepare(
          "SELECT DISTINCT reminder_time FROM workspace_settings",
        ).all()
      ).results,
    ).toEqual([{ reminder_time: "09:00" }]);
    const preservedRows = [];
    for (const table of before) {
      const after = await tableSnapshot(table.name);
      const comparable =
        table.name === "workspace_settings"
          ? after.map(({ reminder_time: _newDefault, ...old }) => old)
          : table.name === "issue_comments"
            ? after.map(({ imported_author_name, ...old }) => {
                expect(imported_author_name).toBeNull();
                return old;
              })
          : sourceIdentityTables.has(table.name)
            ? after.map(({ erased, ...old }) => {
                expect(erased).toBe(0);
                return old;
              })
            : after;
      expect(comparable, table.name).toEqual(table.rows);
      preservedRows.push({
        table: table.name,
        before: table.rows.length,
        after: after.length,
      });
    }
    expect(
      new Uint8Array(
        await (await env.FILES.get("baseline-upgrade-file"))!.arrayBuffer(),
      ),
    ).toEqual(new Uint8Array([0, 1, 2, 255]));
    expect(
      (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
    await validateArchiveInventory(env.DB);
    // Upgraded installations are preserved, never retrospectively declared a
    // pristine disposable bootstrap by the new HTTP restore admission.
    expect(await env.DB.prepare('SELECT 1 FROM vector_http_bootstrap').first()).toBeNull();
    expect(await env.DB.prepare('SELECT 1 FROM vector_http_restore').first()).toBeNull();
    expect(
      (await request("/api/session", "GET", undefined, cookie, sampleBindings))
        .status,
    ).toBe(200);
    // The same populated upgrade also proves both new reminder stores can serve real Cron work.
    expect(
      (
        await request(
          "/api/settings",
          "PATCH",
          { timezone: "UTC" },
          cookie,
          sampleBindings,
        )
      ).status,
    ).toBe(200);
    const created = await request(
      "/api/issues",
      "POST",
      {
        title: "Post-upgrade reminder",
        teamId: ids.flow,
        assigneeOperatorId: ids.sarah,
        dueDate: "2026-10-11",
      },
      cookie,
      sampleBindings,
    );
    expect(created.status).toBe(201);
    const issue = (await created.json()) as { id: string; identifier: string };
    expect(
      (
        await request(
          "/api/issues/" + issue.identifier + "/subscription",
          "PATCH",
          { muted: true },
          cookie,
          sampleBindings,
        )
      ).status,
    ).toBe(200);
    await scheduled(
      { scheduledTime: Date.parse("2026-10-11T23:00:00Z") },
      sampleBindings,
    );
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM due_reminder_suppressions WHERE issue_id=? AND operator_id=?",
      )
        .bind(issue.id, ids.sarah)
        .first("n"),
    ).toBe(1);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM due_reminders WHERE issue_id=?",
      )
        .bind(issue.id)
        .first("n"),
    ).toBe(0);
    expect(
      (
        await request(
          "/api/issues/" + issue.identifier + "/subscription",
          "PATCH",
          { muted: false },
          cookie,
          sampleBindings,
        )
      ).status,
    ).toBe(200);
    await scheduled(
      { scheduledTime: Date.parse("2026-10-13T23:00:00Z") },
      sampleBindings,
    );
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM due_reminders WHERE issue_id=? AND kind='overdue'",
      )
        .bind(issue.id)
        .first("n"),
    ).toBe(1);
    expect(
      await env.DB.prepare(
        "SELECT action,subject_identifier,created_at FROM audit_records WHERE subject_id=? AND action='due_reminder.delivered'",
      )
        .bind(issue.id)
        .first(),
    ).toEqual({
      action: "due_reminder.delivered",
      subject_identifier: issue.identifier,
      created_at: "2026-10-13T23:00:00.000Z",
    });
    expect(
      (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
    const dueAudit = (
      await env.DB.prepare(
        "SELECT * FROM audit_records WHERE subject_id=? AND action='due_reminder.delivered'",
      )
        .bind(issue.id)
        .all()
    ).results;
    const currentIssue = (await (
      await request(
        "/api/issues/" + issue.identifier,
        "GET",
        undefined,
        cookie,
        sampleBindings,
      )
    ).json()) as { version: number };
    const deleted = await request(
      "/api/issues/" + issue.identifier,
      "DELETE",
      { expectedVersion: currentIssue.version, confirmed: true },
      cookie,
      sampleBindings,
    );
    expect(deleted.status, await deleted.clone().text()).toBe(200);
    for (const table of [
      "due_reminders",
      "due_reminder_suppressions",
      "notifications",
    ])
      expect(
        (
          await env.DB.prepare("SELECT * FROM " + table + " WHERE issue_id=?")
            .bind(issue.id)
            .all()
        ).results,
      ).toEqual([]);
    expect(
      (
        await env.DB.prepare(
          "SELECT * FROM audit_records WHERE subject_id=? AND action='due_reminder.delivered'",
        )
          .bind(issue.id)
          .all()
      ).results,
    ).toEqual(dueAudit);
    expect(dueAudit).toHaveLength(1);
    console.info(
      "baseline-upgrade-preserved-rows",
      JSON.stringify(preservedRows),
    );
  },
);
