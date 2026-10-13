import { env } from "cloudflare:workers";
import { beforeAll, it, expect } from "vitest";
import { contractWith } from "../contract-tags";
import { setup, create, ids, select } from "./bulk-parent-fixture";
import { bulkUpdateIssues } from "../../src/core/features/bulk-edit/repository";
import { mutationDatabase } from "../../src/core/features/auth/mutation-database";
import { configureNotifications } from "../../src/core/features/notifications/context";
beforeAll(setup);
contractWith(
  it,
  "VIEW-004 ISSUE-005 ISSUE-007 NOTIFY-001 NOTIFY-002 NOTIFY-003 NOTIFY-004 NOTIFY-006",
  "commits all changed fields once, creates durable assignment intents and respects mutes",
  async () => {
    const a = await create(),
      b = await create();
    await env.DB.prepare(
      "INSERT INTO issue_notification_mutes(issue_id,operator_id) VALUES(?,?)",
    )
      .bind(b.id, ids.maya)
      .run();
    const db = mutationDatabase(env.DB, ids.sarah);
    configureNotifications(db, {
      ...env,
      APP_ORIGIN: "http://localhost:15928",
      MAIL_MODE: "local-outbox",
      MAIL_FROM: "Vector <vector@example.test>",
    });
    const result = await bulkUpdateIssues(db, ids.sarah, {
      issues: select(a, b),
      changes: {
        statusId: ids.flowStarted,
        assigneeOperatorId: ids.maya,
        priority: "urgent",
        projectId: ids.reliability,
        cycleId: ids.flowCycle,
        labelIds: [ids.reliabilityLabel],
      },
    });
    expect(result).toEqual({
      issues: [
        { identifier: a.identifier, version: 2 },
        { identifier: b.identifier, version: 2 },
      ],
      changed: 2,
    });
    for (const issue of [a, b]) {
      const row = await env.DB.prepare("SELECT * FROM issues WHERE id=?")
        .bind(issue.id)
        .first<any>();
      expect([
        row.version,
        row.status_id,
        row.assignee_operator_id,
        row.priority,
        row.project_id,
        row.cycle_id,
      ]).toEqual([
        2,
        ids.flowStarted,
        ids.maya,
        "urgent",
        ids.reliability,
        ids.flowCycle,
      ]);
      const activity = await env.DB.prepare(
        "SELECT * FROM issue_activity WHERE issue_id=? AND kind='issue.updated'",
      )
        .bind(issue.id)
        .all<any>();
      expect(activity.results).toHaveLength(1);
      expect(JSON.parse(activity.results[0].previous_value_json)).toMatchObject(
        {
          statusId: issue.status.id,
          priority: "none",
          assigneeOperatorId: null,
          projectId: null,
          cycleId: null,
          labelIds: [],
        },
      );
      expect(JSON.parse(activity.results[0].next_value_json)).toMatchObject({
        statusId: ids.flowStarted,
        priority: "urgent",
        labelIds: [ids.reliabilityLabel],
      });
      expect(
        await env.DB.prepare(
          "SELECT count(*) n FROM issue_followers WHERE issue_id=? AND operator_id=?",
        )
          .bind(issue.id, ids.maya)
          .first("n"),
      ).toBe(1);
    }
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM notifications WHERE issue_id IN (?,?) AND recipient_id=?",
      )
        .bind(a.id, b.id, ids.maya)
        .first("n"),
    ).toBe(1);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM notifications WHERE issue_id IN (?,?) AND recipient_id=?",
      )
        .bind(a.id, b.id, ids.sarah)
        .first("n"),
    ).toBe(0);
    const intents = await env.DB.prepare(
      "SELECT * FROM notification_deliveries WHERE notification_id IN (SELECT id FROM notifications WHERE issue_id IN (?,?))",
    )
      .bind(a.id, b.id)
      .all<any>();
    expect(intents.results).toHaveLength(1);
    expect(intents.results[0].status).toBe("pending");
  },
);
contractWith(
  it,
  "VIEW-004 NOTIFY-001 NOTIFY-003 NOTIFY-004 NOTIFY-006",
  "bulk finalization notifies the last-blocker resolution once and honors email preferences",
  async () => {
    const a = await create(),
      b = await create(),
      blocked = await create({ assigneeOperatorId: ids.maya });
    await env.DB.batch(
      [a, b].map((issue) =>
        env.DB.prepare(
          "INSERT INTO issue_dependencies(blocked_issue_id,blocking_issue_id,created_at) VALUES(?,?,?)",
        ).bind(blocked.id, issue.id, new Date().toISOString()),
      ),
    );
    await bulkUpdateIssues(env.DB, ids.sarah, {
      issues: select(a, b),
      changes: { statusId: ids.flowCompleted },
    });
    const notifications = await env.DB.prepare(
      "SELECT causes_json FROM notifications WHERE issue_id=? AND recipient_id=? AND causes_json LIKE '%unblocked%'",
    )
      .bind(blocked.id, ids.maya)
      .all<any>();
    expect(notifications.results).toHaveLength(1);
    expect(JSON.parse(notifications.results[0].causes_json)).toEqual([
      "unblocked",
    ]);
    const c = await create(),
      d = await create();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO notification_preferences(operator_id,email_enabled) VALUES(?,0)",
    )
      .bind(ids.maya)
      .run();
    const db = mutationDatabase(env.DB, ids.sarah);
    configureNotifications(db, {
      ...env,
      APP_ORIGIN: "http://localhost:15928",
      MAIL_MODE: "local-outbox",
      MAIL_FROM: "Vector <vector@example.test>",
    });
    await bulkUpdateIssues(db, ids.sarah, {
      issues: select(c, d),
      changes: { assigneeOperatorId: ids.maya },
    });
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM notifications WHERE issue_id IN (?,?) AND recipient_id=?",
      )
        .bind(c.id, d.id, ids.maya)
        .first("n"),
    ).toBe(2);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM notification_deliveries WHERE notification_id IN(SELECT id FROM notifications WHERE issue_id IN (?,?))",
      )
        .bind(c.id, d.id)
        .first("n"),
    ).toBe(0);
  },
);
