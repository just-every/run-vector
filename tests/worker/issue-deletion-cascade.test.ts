import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { setup, call } from "./bulk-parent-fixture";
import { cascadeFixture } from "./issue-deletion-cascade-fixture";
import { deleteRequest } from "./issue-deletion-request";
import { finalizeFile } from "../../src/core/features/discussion/repository";
import { ids } from "./bulk-parent-fixture";
import { scheduled } from "../../src/core/app/scheduled";
beforeAll(setup);
it("[ISSUE-010 BASE-DATA-003 BASE-OPS-002] every native dependency and private file is erased while a rich unrelated control and identifier history survive", async () => {
  const target = await cascadeFixture("erased"),
    control = await cascadeFixture("control");
  // The unrelated control has no requested removal for Cron to settle.
  await env.DB.prepare(
    "UPDATE issue_files SET deleted_at=NULL,removal_requested_at=NULL WHERE issue_id=?",
  )
    .bind(control.parent.id)
    .run();
  const before = await target.rows(),
    untouched = await control.rows();
  for (const [table, rows] of Object.entries(before))
    expect(rows.length, table + " fixture count").toBeGreaterThan(0);
  for (const file of target.files.filter((f) => f.state !== "pending"))
    expect(await (await env.FILES.get(file.key))!.text()).toBe("data");
  const mailAuditBefore = (
    await env.DB.prepare(
      "SELECT * FROM notification_mail_audit ORDER BY id",
    ).all()
  ).results;
  const auditsBefore = (
    await env.DB.prepare(
      "SELECT * FROM audit_records WHERE action='due_reminder.delivered' ORDER BY id",
    ).all()
  ).results;
  const sourceBefore = (
    await env.DB.prepare(
      "SELECT * FROM vector_source_receipts ORDER BY source_id",
    ).all()
  ).results;
  const recordsBefore = (
    await env.DB.prepare(
      "SELECT * FROM vector_source_records ORDER BY source_id",
    ).all()
  ).results;
  const sequenceBefore = (
    await env.DB.prepare(
      "SELECT * FROM issue_prefix_sequences ORDER BY workspace_id,identifier_prefix",
    ).all()
  ).results;
  const result = await deleteRequest(
    target.parent.identifier,
    target.parent.version,
  );
  expect(result.status, await result.clone().text()).toBe(202);
  const after = await target.rows();
  for (const [table, rows] of Object.entries(after))
    expect(rows, table + " erased count").toEqual([]);
  expect(await control.rows()).toEqual(untouched);
  expect(
    (
      await env.DB.prepare(
        "SELECT * FROM notification_mail_audit ORDER BY id",
      ).all()
    ).results,
  ).toEqual(mailAuditBefore);
  expect(
    (
      await env.DB.prepare(
        "SELECT * FROM audit_records WHERE action='due_reminder.delivered' ORDER BY id",
      ).all()
    ).results,
  ).toEqual(auditsBefore);
  for (const file of control.files.filter((f) => f.state !== "pending"))
    expect(await (await env.FILES.get(file.key))!.text()).toBe("data");
  const retained = (
    await env.DB.prepare(
      "SELECT * FROM vector_source_receipts ORDER BY source_id",
    ).all()
  ).results;
  expect(retained).toHaveLength(sourceBefore.length);
  const recordsAfter = (
    await env.DB.prepare(
      "SELECT * FROM vector_source_records ORDER BY source_id",
    ).all()
  ).results;
  expect(recordsAfter).toHaveLength(recordsBefore.length);
  expect(
    recordsAfter.find((row) => row.issue_id === control.parent.id),
  ).toEqual(recordsBefore.find((row) => row.issue_id === control.parent.id));
  expect(
    recordsAfter.find((row) => row.issue_id === target.parent.id),
  ).toMatchObject({ erased: 1 });
  const privateIdentityRows = JSON.stringify(
    [...recordsAfter, ...retained].filter(
      (row) => row.issue_id === target.parent.id,
    ),
  );
  expect(privateIdentityRows).not.toContain("erased-record");
  expect(privateIdentityRows).not.toContain("erased-source-revision");

  expect(retained.find((row) => row.issue_id === control.parent.id)).toEqual(
    sourceBefore.find((row) => row.issue_id === control.parent.id),
  );
  expect(
    retained.find((row) => row.issue_id === target.parent.id),
  ).toMatchObject({
    erased: 1,
    issue_id: target.parent.id,
    payload_hash: "opaque-hash",
  });
  expect(
    (
      await env.DB.prepare(
        "SELECT * FROM issue_prefix_sequences ORDER BY workspace_id,identifier_prefix",
      ).all()
    ).results,
  ).toEqual(sequenceBefore);
  expect((await call("/issues/" + target.parent.identifier)).status).toBe(404);
  const pending = target.files.find((f) => f.state === "pending")!;
  await env.FILES.put(pending.key, "data", {
    customMetadata: { operationId: pending.id, sha256: "checksum" },
  });
  await finalizeFile(env.DB, target.parent.id, pending.id, ids.sarah);
  await scheduled(
    { scheduledTime: Date.now() },
    { ...env, APP_ORIGIN: "https://vector.test" },
  );
  for (const file of target.files)
    expect(await env.FILES.head(file.key)).toBeNull();
  expect(await control.rows()).toEqual(untouched);
  expect(
    await (
      await call("/issues/" + target.parent.identifier + "/deletion")
    ).json(),
  ).toMatchObject({ cleanup: "complete", files: 3, removed: 3 });
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
  console.info(
    "issue-deletion-table-counts",
    JSON.stringify([
      ...Object.keys(before).map((table) => ({
        table,
        before: before[table].length,
        after: after[table].length,
        unrelated: untouched[table].length,
      })),
      {
        table: "vector_source_records",
        before: recordsBefore.length,
        after: recordsAfter.length,
        unrelated: 1,
      },
      {
        table: "vector_source_receipts",
        before: sourceBefore.length,
        after: retained.length,
        unrelated: 1,
      },
      {
        table: "notification_mail_audit",
        before: mailAuditBefore.length,
        after: mailAuditBefore.length,
        unrelated: 1,
      },
    ]),
  );
});
