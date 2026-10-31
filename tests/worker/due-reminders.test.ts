import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import {
  reminderFixture,
  tick,
  effectCounts,
  beforeReminderClaim,
} from "./due-reminders-fixture";
import { testCookie } from "./native-fixture";
import { verifyReminderReassignment } from "./due-reminders-reassignment";
import { invite, actor, request } from "./base-auth-fixture";
import { createUlid } from "../../src/core/shared/ids";
const check = (clauses: string, name: string, run: () => Promise<void>) =>
  contractWith(it, clauses, name, run);
check(
  "AUTO-006 ROLE-001 CYCLE-008 NOTIFY-001 NOTIFY-005 NOTIFY-006 OPS-003 BASE-OPS-005",
  "due and first-overdue Cron reminders are Inbox-only, timely, concurrent-safe and late-tick eligible",
  async () => {
    const f = await reminderFixture();
    await f.configure("Australia/Brisbane");
    const issue = await f.create();
    const before = await effectCounts();
    await tick("2026-10-10T22:59:00Z");
    expect(await f.notifications()).toHaveLength(0);
    await Promise.all([
      tick("2026-10-10T23:01:00Z"),
      tick("2026-10-10T23:01:00Z"),
    ]);
    expect(await f.notifications()).toMatchObject([
      { identifier: issue.identifier, createdAt: "2026-10-10T23:01:00.000Z" },
    ]);
    await tick("2026-10-10T23:06:00Z");
    expect(await f.notifications()).toHaveLength(1);
    const late = await f.create();
    const afterCreate = await effectCounts();
    await tick("2026-10-11T03:00:00Z");
    expect((await f.notifications()).map((n) => n.identifier)).toContain(
      late.identifier,
    );
    expect(await effectCounts()).toEqual({
      ...afterCreate,
      audit_records: afterCreate.audit_records + 1,
    });
    await Promise.all([
      tick("2026-10-11T14:01:00Z"),
      tick("2026-10-11T14:01:00Z"),
    ]);
    await tick("2026-10-12T14:01:00Z");
    expect(await f.notifications()).toHaveLength(4);
    expect(
      (
        await env.DB.prepare(
          "SELECT kind,count(*) n FROM due_reminders GROUP BY kind ORDER BY kind",
        ).all()
      ).results,
    ).toEqual([
      { kind: "due_today", n: 2 },
      { kind: "overdue", n: 2 },
    ]);
    expect(await effectCounts()).toEqual({
      ...afterCreate,
      audit_records: afterCreate.audit_records + 3,
    });
    expect(before.notification_deliveries).toBe(0);
    const audits = (
      await env.DB.prepare(
        "SELECT actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at FROM audit_records WHERE action='due_reminder.delivered' ORDER BY created_at,subject_identifier",
      ).all()
    ).results;
    expect(audits).toEqual(
      [
        [issue, "2026-10-10T23:01:00.000Z"],
        [late, "2026-10-11T03:00:00.000Z"],
        ...[issue, late]
          .sort((a, b) => a.identifier.localeCompare(b.identifier))
          .map((i) => [i, "2026-10-11T14:01:00.000Z"]),
      ].map(([i, at]) => ({
        actor_operator_id: null,
        action: "due_reminder.delivered",
        subject_identifier: (i as typeof issue).identifier,
        subject_id: (i as typeof issue).id,
        created_at: at,
        updated_at: at,
      })),
    );
    const page = await f.call("/notifications");
    const row = ((await page.json()) as { items: { id: string }[] }).items[0];
    expect(
      (await f.call("/notifications/" + row.id + "/read", "POST")).status,
    ).toBe(200);
    const currentIssue = (await (
      await f.call("/issues/" + issue.identifier)
    ).json()) as { version: number };
    const removed = await f.call("/issues/" + issue.identifier, "DELETE", {
      expectedVersion: currentIssue.version,
      confirmed: true,
    });
    expect(removed.status, await removed.clone().text()).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM due_reminders WHERE issue_id=?",
      )
        .bind(issue.id)
        .first("n"),
    ).toBe(0);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM notifications WHERE issue_id=?",
      )
        .bind(issue.id)
        .first("n"),
    ).toBe(0);
    expect(
      (
        await env.DB.prepare(
          "SELECT actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at FROM audit_records WHERE action='due_reminder.delivered' ORDER BY created_at,subject_identifier",
        ).all()
      ).results,
    ).toEqual(audits);
    await (await import('./due-rule-proof')).proveDueRuleCalendar();
  },
);
check(
  "NOTIFY-005 OPS-003",
  "date edits and workspace clocks preserve delivered identities through DST gaps and repeats",
  async () => {
    const f = await reminderFixture();
    await f.configure("America/New_York", "02:30");
    const issue = await f.create({ dueDate: "2026-03-08" });
    await tick("2026-03-08T06:59:00Z");
    expect(await f.notifications()).toHaveLength(0);
    await tick("2026-03-08T07:00:00Z"); // First observable local time after the spring gap.
    expect(await f.notifications()).toHaveLength(1);
    expect(
      (
        await f.call("/issues/" + issue.identifier, "PATCH", {
          expectedVersion: 1,
          dueDate: "2026-11-01",
        })
      ).status,
    ).toBe(200);
    await f.configure("America/New_York", "01:30");
    await tick("2026-11-01T05:29:00Z");
    expect(await f.notifications()).toHaveLength(1);
    await tick("2026-11-01T05:30:00Z");
    await tick("2026-11-01T06:30:00Z"); // Repeated wall minute.
    expect(await f.notifications()).toHaveLength(2);
    await f.configure("UTC", "08:45");
    await tick("2026-11-01T09:00:00Z");
    expect(await f.notifications()).toHaveLength(2);
    expect(
      (
        await f.call("/issues/" + issue.identifier, "PATCH", {
          expectedVersion: 2,
          dueDate: "2026-03-08",
        })
      ).status,
    ).toBe(200);
    await f.configure("America/New_York", "02:30");
    await tick("2026-03-08T08:00:00Z");
    expect(await f.notifications()).toHaveLength(2);
    const today = await f.create({ dueDate: "2026-11-02" });
    await f.configure("Pacific/Kiritimati", "10:30");
    await tick("2026-11-01T20:29:00Z");
    expect(
      (await f.notifications()).filter(
        (n) => n.identifier === today.identifier,
      ),
    ).toHaveLength(0);
    await tick("2026-11-01T20:31:00Z");
    expect(
      (await f.notifications()).filter(
        (n) => n.identifier === today.identifier,
      ),
    ).toHaveLength(1);
  },
);
check(
  "NOTIFY-005 NOTIFY-003 NOTIFY-004 OPS-004 BASE-OPS-005",
  "eligibility excludes terminal, unassigned, removed and native-inactive operators; mutes consume without backfill",
  async () => {
    const f = await reminderFixture();
    await f.configure("UTC");
    const active = await f.create(),
      muted = await f.create();
    const excluded = [(await f.create({ assigneeOperatorId: null })).id];
    for (const category of ["completed", "canceled", "duplicate"]) {
      const issue = await f.create();
      excluded.push(issue.id);
      // Duplicate is authored by its separate decision path; fixture records all terminal categories.
      await env.DB.prepare("UPDATE issues SET status_id=? WHERE id=?")
        .bind(
          f.initial.teams[0].statuses.find((s) => s.category === category)!.id,
          issue.id,
        )
        .run();
    }
    for (const mode of ["removed", "inactive"]) {
      const id = createUlid(new Date());
      const workspace = await env.DB.prepare(
        "SELECT workspace_id FROM operators WHERE id=?",
      )
        .bind(f.owner)
        .first("workspace_id");
      await env.DB.prepare(
        "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      )
        .bind(
          id,
          workspace,
          mode,
          id + "@reminder.test",
          "2026-10-01",
          "2026-10-01",
        )
        .run();
      await testCookie(env.DB, id);
      excluded.push((await f.create({ assigneeOperatorId: id })).id);
      if (mode === "removed")
        await env.DB.prepare(
          "UPDATE operators SET removed_at='2026-10-10' WHERE id=?",
        )
          .bind(id)
          .run();
      else
        await env.DB.prepare(
          "UPDATE oa_operators SET status='inactive' WHERE id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)",
        )
          .bind(id)
          .run();
    }
    expect(
      (
        await f.call("/issues/" + muted.identifier + "/subscription", "PATCH", {
          muted: true,
        })
      ).status,
    ).toBe(200);
    const before = await effectCounts();
    await tick("2026-10-11T09:01:00Z");
    expect((await f.notifications()).map((n) => n.identifier)).toEqual([
      active.identifier,
    ]);
    expect(await effectCounts()).toEqual({
      ...before,
      audit_records: before.audit_records + 1,
    });
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM due_reminders WHERE issue_id IN (SELECT value FROM json_each(?))",
      )
        .bind(JSON.stringify(excluded))
        .first("n"),
    ).toBe(0);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM notifications WHERE issue_id IN (SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM json_each(causes_json) WHERE value='due_reminder')",
      )
        .bind(JSON.stringify(excluded))
        .first("n"),
    ).toBe(0);
    await f.call("/issues/" + muted.identifier + "/subscription", "PATCH", {
      muted: false,
    });
    await tick("2026-10-11T12:00:00Z");
    expect(await f.notifications()).toHaveLength(1);
    expect(
      (
        await f.call("/settings/notifications", "PATCH", {
          mutedKinds: ["comment", "due_reminder"],
        })
      ).status,
    ).toBe(200);
    await tick("2026-10-12T00:01:00Z");
    await f.call("/settings/notifications", "PATCH", {
      mutedKinds: ["comment"],
    });
    await tick("2026-10-12T10:00:00Z");
    expect(await f.notifications()).toHaveLength(1);
    expect(await effectCounts()).toEqual({
      ...before,
      audit_records: before.audit_records + 1,
    });
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM due_reminder_suppressions WHERE issue_id IN (?,?)",
      )
        .bind(active.id, muted.id)
        .first("n"),
    ).toBe(3);
    await verifyReminderReassignment(f);
  },
);
check(
  "NOTIFY-005 OPS-003",
  "a scheduled observation rechecks settings, due date, assignee, status, native activity and mutes",
  async () => {
    const f = await reminderFixture();
    const raceCookie = await invite("reminder-race@vector.test", f.cookie);
    const raceAssignee = await actor(raceCookie);
    const changes = [
      "UPDATE workspace_settings SET reminder_time='18:00'",
      "UPDATE workspace_settings SET timezone='Pacific/Honolulu'",
      "UPDATE issues SET due_date='2026-10-12' WHERE id=?",
      "UPDATE issues SET assignee_operator_id=NULL WHERE id=?",
      "UPDATE issues SET status_id=(SELECT id FROM workflow_statuses WHERE team_id=issues.team_id AND category='completed' LIMIT 1) WHERE id=?",
      "INSERT INTO issue_notification_mutes(issue_id,operator_id) SELECT id,assignee_operator_id FROM issues WHERE id=?",
      "UPDATE oa_operators SET status='inactive' WHERE id=(SELECT m.auth_id FROM vector_auth_operators m JOIN issues i ON i.assignee_operator_id=m.operator_id WHERE i.id=?)",
    ];
    for (const sql of changes) {
      await f.configure("UTC");
      const nativeRace = sql.startsWith("UPDATE oa_operators");
      const issue = await f.create(
        nativeRace ? { assigneeOperatorId: raceAssignee } : {},
      );
      const db = beforeReminderClaim(() => {
        const query = env.DB.prepare(sql);
        return (sql.includes("?") ? query.bind(issue.id) : query).run();
      });
      await tick("2026-10-11T09:00:00Z", db);
      if (nativeRace)
        expect(
          (await request("/api/notifications", "GET", undefined, raceCookie))
            .status,
        ).toBe(401);
      expect(
        (await f.notifications()).filter(
          (n) => n.identifier === issue.identifier,
        ),
      ).toHaveLength(0);
      expect(
        await env.DB.prepare(
          "SELECT count(*) n FROM due_reminders WHERE issue_id=?",
        )
          .bind(issue.id)
          .first("n"),
      ).toBe(0);
      expect(
        await env.DB.prepare(
          "SELECT count(*) n FROM audit_records WHERE subject_id=? AND action='due_reminder.delivered'",
        )
          .bind(issue.id)
          .first("n"),
      ).toBe(0);
      expect(
        await env.DB.prepare(
          "SELECT count(*) n FROM due_reminder_suppressions WHERE issue_id=?",
        )
          .bind(issue.id)
          .first("n"),
      ).toBe(sql.startsWith("INSERT INTO issue_notification_mutes") ? 1 : 0);
    }
  },
);
check(
  "AUTO-006 ROLE-001 NOTIFY-005 BASE-DATA-001",
  "restored effects hold new reminders until reviewed while preserving historical claims",
  async () => {
    const f = await reminderFixture();
    await f.configure("UTC");
    await f.create();
    await env.DB.prepare(
      "INSERT INTO vector_restore_status(id,import_id,effects_held) VALUES(1,'synthetic-restore',1)",
    ).run();
    const before = await env.DB.prepare(
      "SELECT count(*) n FROM due_reminders",
    ).first("n");
    await tick("2026-10-11T09:00:00Z");
    expect(
      await env.DB.prepare("SELECT count(*) n FROM due_reminders").first("n"),
    ).toBe(before);
    await env.DB.prepare(
      "INSERT INTO vector_restore_operator_grants(auth_id,approved_at) SELECT auth_id,'2026-10-11' FROM vector_auth_operators WHERE operator_id=?",
    )
      .bind(f.owner)
      .run();
    expect((await f.call("/data/restore/review-effects", "POST")).status).toBe(
      200,
    );
    await tick("2026-10-11T10:00:00Z");
    expect(await f.notifications()).toHaveLength(1);
    await (await import('./due-rule-upgrade')).proveDueRuleUpgrade();
    await (await import('./due-rule-proof')).proveDueRuleAuthority();
  },
);
