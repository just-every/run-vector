import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { createIssueRecord } from "../../src/core/features/issues/repository";
import { createIssueInputSchema } from "../../src/core/features/issues/input";
import { addComment } from "../../src/core/features/discussion/repository";
import { configureNotifications } from "../../src/core/features/notifications/context";
import { mutationDatabase } from "../../src/core/features/auth/mutation-database";
import { bindings } from "./base-auth-fixture";
import { removeOperator } from "../../src/core/features/settings/removal";
import { mentionToken } from "../../src/core/features/notifications/mention-token";
contractWith(
  it,
  "NOTIFY-001 NOTIFY-002 NOTIFY-006 BASE-OPS-004",
  "source transaction failure rolls back issue, followers, mention sets, inbox and delivery intents together",
  async () => {
    const f = await collaborationFixture();
    const source = new Proxy(env.DB, {
      get(target, key) {
        if (key === "batch")
          return (statements: D1PreparedStatement[]) =>
            target.batch([
              ...statements,
              target.prepare("SELECT json('source transaction failpoint')"),
            ]);
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const db = mutationDatabase(source, f.owner);
    configureNotifications(db, bindings);
    // Allocation uses a guarded batch too; use comment creation to inject failure
    // after every source statement, including the new delivery intent.
    const issue = await f.create();
    const before = {
      comments: await count("issue_comments"),
      activity: await count("issue_activity"),
      followers: await count("issue_followers"),
    };
    await expect(
      addComment(
        db,
        issue.id,
        f.owner,
        mentionToken({ id: f.bob, name: "Bob" }),
      ),
    ).rejects.toThrow();
    expect(await count("issue_comments")).toBe(before.comments);
    expect(await count("issue_activity")).toBe(before.activity);
    expect(await count("issue_followers")).toBe(before.followers);
    for (const table of [
      "issue_mentions",
      "notifications",
      "notification_deliveries",
      "notification_candidates",
    ])
      expect(await count(table), table).toBe(0);
    // A failed issue source cannot create any event either.
    await expect(
      createIssueRecord(db, {
        actorOperatorId: f.owner,
        now: new Date(),
        input: createIssueInputSchema.parse({
          title: "Rejected source",
          teamId: f.initial.teams[0].id,
          assigneeOperatorId: f.bob,
        }),
      }),
    ).rejects.toThrow();
    expect(await count("issues", "title='Rejected source'")).toBe(0);
  },
);
contractWith(
  it,
  "OPS-004 BASE-DATA-003 ISSUE-010 NOTIFY-006",
  "actor erasure anonymizes retained inbox and mail while issue erasure cascades collaboration records",
  async () => {
    const f = await collaborationFixture();
    const response = await f.any(f.bobCookie, "/issues", "POST", {
      title: "Actor erasure title",
      teamId: f.initial.teams[0].id,
      assigneeOperatorId: f.cara,
    });
    expect(response.status).toBe(201);
    const issue = (await response.json()) as { id: string; identifier: string };
    await removeOperator(env.DB, f.owner, f.bob);
    const n = await env.DB.prepare(
      "SELECT actor_id,actor_name FROM notifications WHERE issue_id=?",
    )
      .bind(issue.id)
      .first();
    expect(n).toEqual({ actor_id: null, actor_name: "Removed operator" });
    const mail = await env.DB.prepare(
      "SELECT text FROM (SELECT json_extract(message,'$.deliveryId') AS delivery_id,json_extract(message,'$.to[0]') AS recipient,json_extract(message,'$.subject') AS subject,json_extract(message,'$.text') AS text,created_at FROM rer_mail_development_outbox WHERE json_extract(message,'$.text') LIKE '%'||char(10)||'Sign in to view this issue.')",
    ).first<{ text: string }>();
    expect(mail!.text).toContain("By: Removed operator");
    expect(mail!.text).not.toContain("By: bob");
    const audit = (
      await env.DB.prepare("SELECT * FROM notification_mail_audit").all()
    ).results;
    expect(audit.length).toBeGreaterThan(0);
    expect(Object.keys(audit.at(-1)!).sort()).toEqual([
      "created_at",
      "feature",
      "id",
      "outcome",
      "subject_identifier",
    ]);
    expect(JSON.stringify(audit)).not.toContain("Actor erasure title");
    expect(JSON.stringify(audit)).not.toContain("collaboration.test");
    await env.DB.prepare("DELETE FROM issues WHERE id=?").bind(issue.id).run();
    for (const table of [
      "notifications",
      "notification_deliveries",
      "notification_delivery_attempts",
      "notification_development_mail",
      "issue_followers",
      "issue_mentions",
    ])
      expect(await count(table), table).toBe(0);
    expect(
      (await env.DB.prepare("SELECT * FROM notification_mail_audit").all())
        .results,
    ).toEqual(audit);
  },
);
