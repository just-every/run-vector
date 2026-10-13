import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { writeRuntimeD1 } from "./runtime-d1.mjs";

// Test-only native D1 presentation fixture. Real UI events supply the source
// notifications while email is opted out. These fresh terminal intents exercise
// Settings presentation; Worker transport tests, not this fixture, prove outcomes.
export async function insertDeliveryPresentationFixture(
  runtime,
  notificationId,
  status,
) {
  assert.ok(["failed", "uncertain"].includes(status));
  const directory = resolve(runtime.state, "v3/d1/miniflare-D1DatabaseObject");
  const files = readdirSync(directory).filter((name) =>
    /^[a-f0-9]{64}\.sqlite$/.test(name),
  );
  assert.equal(files.length, 1);
  // Reads only: the rows are written through the running Worker's own D1.
  const db = new DatabaseSync(resolve(directory, files[0]), { readOnly: true });
  try {
    assert.equal(
      db
        .prepare(
          "SELECT count(*) n FROM notification_deliveries WHERE notification_id=?",
        )
        .get(notificationId).n,
      0,
      "fixture never resets an existing delivery",
    );
    const notification = db
      .prepare(
        "SELECT n.*,i.identifier,i.title FROM notifications n JOIN issues i ON i.id=n.issue_id WHERE n.id=?",
      )
      .get(notificationId);
    assert.ok(notification);
    const at = new Date().toISOString(),
      attempts = status === "failed" ? 3 : 1,
      claim = randomUUID();
    const reason =
      status === "failed" ? "retry_exhausted" : "submission_uncertain";
    await writeRuntimeD1(runtime.base, [
      { sql: `INSERT INTO notification_deliveries(id,notification_id,recipient_id,actor_id,actor_name,identifier,title,app_link,status,attempts,claim_token,claimed_at,reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        params: [notificationId, notificationId, notification.recipient_id, notification.actor_id, notification.actor_name, notification.identifier, notification.title, runtime.base + "/app/issues/" + notification.identifier, status, attempts, claim, at, reason, at, at] },
      ...Array.from({ length: attempts }, (_, index) => ({
        sql: `INSERT INTO notification_delivery_attempts(id,delivery_id,number,status,reason,started_at,settled_at) VALUES(?,?,?,?,?,?,?)`,
        params: [index + 1 === attempts ? claim : randomUUID(), notificationId, index + 1, status === "failed" ? "rejected" : "uncertain", reason, at, at],
      })),
    ]);
    return {
      source:
        "test-only native D1 presentation fixture on a fresh real UI notification; no transport outcome claim",
      notificationId,
      deliveryId: notificationId,
      status,
      attempts,
    };
  } finally {
    db.close();
  }
}
