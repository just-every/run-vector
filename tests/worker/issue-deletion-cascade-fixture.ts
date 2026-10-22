import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { ids, create } from "./bulk-parent-fixture";
import { fixture } from "./parent-deletion-fixture";
import { bindings } from "./base-auth-fixture";
import { drainNotificationMail } from "../../src/core/features/notifications/mail";
const at = "2026-10-01T00:00:00Z";
export async function cascadeFixture(prefix: string) {
  const family = await fixture({title:prefix+" native issue",description:prefix+" private issue body"}),
    issue = family.parent,
    other = await create();
  const id = (name: string) => prefix + "-" + name;
  const q = (sql: string, ...params: any[]) =>
    env.DB.prepare(sql).bind(...params);
  const workspace = await env.DB.prepare(
    "SELECT workspace_id FROM teams WHERE id=?",
  )
    .bind(ids.flow)
    .first<string>("workspace_id");
  await env.DB.batch([
    q(
      "INSERT INTO issue_labels(issue_id,label_id,created_at) SELECT ?,id,? FROM labels LIMIT 1",
      issue.id,
      at,
    ),
    q(
      "INSERT INTO issue_dependencies(blocked_issue_id,blocking_issue_id,created_at) VALUES(?,?,?),(?,?,?)",
      issue.id,
      other.id,
      at,
      family.child.id,
      issue.id,
      at,
    ),
    q(
      "INSERT INTO evidence_revisions(id,issue_id,source_name,summary,observed_at,received_at,created_at,updated_at) VALUES(?,?,'Synthetic source','Erased evidence',?,?,?,?)",
      id("evidence"),
      issue.id,
      at,
      at,
      at,
      at,
    ),
    q(
      "INSERT INTO intake_decisions(id,issue_id,actor_operator_id,kind,return_at,created_at,updated_at) VALUES(?,?,?,'deferred',?,?,?)",
      id("decision"),
      issue.id,
      ids.sarah,
      at,
      at,
      at,
    ),
    q(
      "INSERT INTO issue_deferral_origins(issue_id,decision_id) VALUES(?,?)",
      issue.id,
      id("decision"),
    ),
    q(
      "INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,created_at,updated_at) VALUES(?,?,?,'issue.assigned',?,?)",
      id("activity"),
      issue.id,
      ids.sarah,
      at,
      at,
    ),
    q(
      "INSERT INTO notification_events(event_id,created_at) VALUES(?,?)",
      id("activity"),
      at,
    ),
    q(
      "INSERT INTO notification_candidates(event_id,issue_id,recipient_id,kind,actor_id,created_at) VALUES(?,?,?,'assignment',?,?)",
      id("activity"),
      issue.id,
      ids.maya,
      ids.sarah,
      at,
    ),
    q(
      "INSERT OR IGNORE INTO issue_followers(issue_id,operator_id,created_at) VALUES(?,?,?)",
      issue.id,
      ids.maya,
      at,
    ),
    q(
      "INSERT INTO issue_notification_mutes(issue_id,operator_id) VALUES(?,?)",
      issue.id,
      ids.sarah,
    ),
    q(
      "INSERT INTO issue_mentions(issue_id,body_key,operator_id) VALUES(?,'description',?)",
      issue.id,
      ids.maya,
    ),
    q(
      `INSERT INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at) VALUES(?,?,?,?,?,'Sarah','["assignment"]',?)`,
      id("notification"),
      id("activity"),
      issue.id,
      ids.maya,
      ids.sarah,
      at,
    ),
    q(
      "INSERT INTO vector_github_issue_links(repository_id,number,issue_id,created_at) VALUES(?,1,?,?)",
      id("repository"),
      issue.id,
      at,
    ),
    q(
      "INSERT INTO vector_github_pull_requests(repository_id,number,title,url,state,updated_at,received_at) VALUES(?,1,'Independent PR','https://github.com/example/test/pull/1','open',?,?)",
      id("repository"),
      at,
      at,
    ),
    q(
      "INSERT INTO vector_import_revisions(issue_id,revision) VALUES(?,?)",
      issue.id,
      id("revision"),
    ),
    q(
      "INSERT INTO due_reminders(issue_id,due_date,kind,claim_id,created_at) VALUES(?,'2026-10-01','due_today',?,?)",
      issue.id,
      id("due-claim"),
      at,
    ),
    q(
      "INSERT INTO due_reminder_suppressions(issue_id,due_date,kind,operator_id,created_at) VALUES(?,'2026-10-01','due_today',?,?)",
      issue.id,
      ids.sarah,
      at,
    ),
    q(
      "INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at) VALUES(?,NULL,'due_reminder.delivered',?,?,?,?)",
      id("due-claim"),
      issue.identifier,
      issue.id,
      at,
      at,
    ),
    q(
      "INSERT INTO vector_source_records(source_id,record_id,issue_id,created_at) VALUES(?,?,?,?)",
      id("source"),
      id("record"),
      issue.id,
      at,
    ),
    q(
      "INSERT INTO vector_source_receipts(source_id,record_id,revision_id,payload_hash,issue_id,evidence_id,received_at) VALUES(?,?,?,?,?,?,?)",
      id("source"),
      id("record"),
      id("source-revision"),
      "opaque-hash",
      issue.id,
      id("evidence"),
      at,
    ),
  ]);
  // Capture the actual admitted native message, including current actor and channel policy.
  await drainNotificationMail(bindings, { eventIds: [id("activity")] });
  const delivery = await env.DB.prepare(
    "SELECT id,status FROM notification_deliveries WHERE notification_id=?",
  ).bind(id("notification")).first<{ id: string; status: string }>();
  expect(delivery).toMatchObject({ status: "development" });
  const deliveryId = delivery!.id;
  // Keep restored custody represented too, after native delivery has captured its message.
  await q(
    "INSERT INTO vector_restore_mail_holds(delivery_id) VALUES(?)",
    deliveryId,
  ).run();
  const selections: Record<string, { where: string; params: any[] }> =
    Object.fromEntries(
      [
        "issue_comments",
        "issue_links",
        "issue_files",
        "issue_labels",
        "evidence_revisions",
        "intake_decisions",
        "issue_activity",
        "issue_deferral_origins",
        "issue_followers",
        "issue_notification_mutes",
        "issue_mentions",
        "notifications",
        "notification_candidates",
        "vector_github_issue_links",
        "vector_import_revisions",
        "due_reminders",
        "due_reminder_suppressions",
      ].map((table) => [table, { where: "issue_id=?", params: [issue.id] }]),
    );
  Object.assign(selections, {
    issues: { where: "id=?", params: [issue.id] },
    search_issues: { where: "id=?", params: [issue.id] },
    issue_dependencies: {
      where: "blocked_issue_id=? OR blocking_issue_id=?",
      params: [issue.id, issue.id],
    },
    issue_parents: {
      where: "issue_id=? OR parent_issue_id=?",
      params: [issue.id, issue.id],
    },
    notification_events: { where: "event_id=?", params: [id("activity")] },
    notification_deliveries: { where: "id=?", params: [deliveryId] },
    notification_delivery_attempts: {
      where: "delivery_id=?",
      params: [deliveryId],
    },
    vector_restore_mail_holds: {
      where: "delivery_id=?",
      params: [deliveryId],
    },
    rer_mail_development_outbox: {
      where: "json_extract(message,'$.deliveryId')=?",
      params: [deliveryId],
    },
  });
  async function rows() {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(selections).map(async ([table, { where, params }]) => [
          table,
          (
            await env.DB.prepare(
              `SELECT * FROM ${table} WHERE ${where} ORDER BY rowid`,
            )
              .bind(...params)
              .all()
          ).results,
        ]),
      ),
    );
  }
  return { ...family, other, rows, workspace };
}
