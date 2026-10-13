import { env } from "cloudflare:workers";
import assert from "node:assert/strict";
import { beforeAll, it } from "vitest";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { changeComment } from "../../src/core/features/discussion/repository";
import { contractWith } from "../contract-tags";
import { assertIndexedReceipt, createIssue, matches, observeBatch, request, setup, state } from "./search-mutation-receipts-fixture";

beforeAll(setup);

contractWith(it, "ISSUE-008 SEARCH-003 BASE-OPS-005 BASE-DATA-003", "comment edit and tombstone receipts agree with committed content, history and live index", async () => {
  const issue = await createIssue();
  const created = await request(`/issues/${issue.identifier}/comments`, "POST", { body: "beforecommenttoken" });
  assert.equal(created.status, 201);
  const { id } = await created.json() as { id: string };
  assert.equal(await matches(issue.id, "beforecommenttoken"), true);
  const path = `/issues/${issue.identifier}/comments/${id}`;
  const before = await state(issue.id), edited = observeBatch();
  const response = await request(path, "PATCH", { body: "aftercommenttoken" }, edited.db);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { updated: true });
  assertIndexedReceipt(edited.receipts, id);
  const afterEdit = await state(issue.id);
  assert.deepEqual(afterEdit.issue, before.issue);
  assert.equal(afterEdit.activity.length, before.activity.length + 1);
  assert.equal(afterEdit.comments[0].body, "aftercommenttoken");
  assert.ok(afterEdit.comments[0].edited_at);
  assert.equal(afterEdit.audit.length, before.audit.length + 1);
  assert.equal(await matches(issue.id, "beforecommenttoken"), false);
  assert.equal(await matches(issue.id, "aftercommenttoken"), true);
  const removed = observeBatch(), deleted = await request(path, "DELETE", undefined, removed.db);
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { updated: true });
  assertIndexedReceipt(removed.receipts, id);
  const afterDelete = await state(issue.id);
  assert.deepEqual(afterDelete.issue, before.issue);
  assert.equal(afterDelete.activity.length, afterEdit.activity.length + 1);
  assert.equal(afterDelete.comments[0].body, null);
  assert.ok(afterDelete.comments[0].deleted_at);
  assert.equal(afterDelete.audit.length, afterEdit.audit.length + 1);
  assert.equal(await matches(issue.id, "aftercommenttoken"), false);
  assert.equal((await request(path, "DELETE")).status, 404);
  assert.deepEqual(await state(issue.id), afterDelete);
});

for (const body of ["latecommenttoken", null])
  contractWith(it, "ISSUE-008 SEARCH-003 BASE-ACCESS-004 BASE-OPS-005", `comment ${body === null ? "deletion" : "edit"} loses a real tombstone race without reporting success or adding history`, async () => {
    const issue = await createIssue();
    const created = await request(`/issues/${issue.identifier}/comments`, "POST", { body: "racingcommenttoken" });
    const { id } = await created.json() as { id: string };
    let committed: Awaited<ReturnType<typeof state>> | undefined;
    const observed = observeBatch(async () => {
      assert.equal(await changeComment(env.DB, issue, id, ids.maya, null), true);
      committed = await state(issue.id);
    });
    const response = await request(`/issues/${issue.identifier}/comments/${id}`, body === null ? "DELETE" : "PATCH", body === null ? undefined : { body }, observed.db);
    assert.equal(response.status, 404);
    assert.ok(committed);
    assert.deepEqual(await state(issue.id), committed);
    assert.equal(await matches(issue.id, "racingcommenttoken OR latecommenttoken"), false);
  });

contractWith(it, "ISSUE-012 ISSUE-006 SEARCH-003 BASE-ACCESS-004", "team move returns the direct mutation with FTS triggers and preserves no-op and stale behavior", async () => {
  const issue = await createIssue({ cycleId: ids.flowCycle }), before = await state(issue.id);
  const observed = observeBatch(), path = `/issues/${issue.identifier}/team`;
  const input = { expectedVersion: 1, teamId: ids.platform, statusId: ids.platformBacklog };
  const response = await request(path, "POST", input, observed.db);
  assert.equal(response.status, 200);
  const dto = await response.json() as any;
  assert.equal(dto.version, 2);
  assert.equal(dto.team.id, ids.platform);
  assert.equal(dto.cycle, null);
  assertIndexedReceipt(observed.receipts, issue.id);
  const after = await state(issue.id);
  assert.equal(after.issue!.version, 2);
  assert.equal(after.activity.length, before.activity.length + 1);
  assert.equal(await matches(issue.id, '"Receipt fixture"'), true);
  assert.equal((await request(path, "POST", { ...input, expectedVersion: 2 })).status, 200);
  assert.deepEqual(await state(issue.id), after);
  assert.equal((await request(path, "POST", input)).status, 409);
  assert.deepEqual(await state(issue.id), after);
});

contractWith(it, "ISSUE-006 SEARCH-003 BASE-ACCESS-004", "title, project and label edits report their committed version and one activity despite index writes", async () => {
  const issue = await createIssue({ title: "originaltitletoken" });
  let version = 1;
  for (const changes of [
    { title: "replacementtitletoken" },
    { projectId: ids.reliability },
    { labelIds: [ids.customerLabel] },
  ]) {
    const before = await state(issue.id), observed = observeBatch();
    const response = await request(`/issues/${issue.identifier}`, "PATCH", { expectedVersion: version, ...changes }, observed.db);
    assert.equal(response.status, 200);
    const dto = await response.json() as any;
    assert.equal(dto.version, ++version);
    const after = await state(issue.id);
    assert.equal(after.issue!.version, version);
    assert.equal(after.activity.length, before.activity.length + 1);
    assert.equal(await matches(issue.id, "replacementtitletoken"), true);
    if ("title" in changes || "projectId" in changes) assertIndexedReceipt(observed.receipts, issue.id);
    if ("projectId" in changes) {
      assert.equal(dto.project.id, changes.projectId);
      assert.equal(await matches(issue.id, '"Customer Reliability"'), true);
    }
    if ("labelIds" in changes) {
      assert.deepEqual(dto.labels.map((label: any) => label.id), changes.labelIds);
      assert.equal(await matches(issue.id, '"Customer escalation"'), true);
    }
    assert.equal((await request(`/issues/${issue.identifier}`, "PATCH", { expectedVersion: version - 1, ...changes })).status, 409);
    assert.deepEqual(await state(issue.id), after);
  }
  assert.equal(await matches(issue.id, "originaltitletoken"), false);
});

contractWith(it, "INTAKE-001 SEARCH-003 BASE-ACCESS-004", "operator intake acknowledges durable issue and evidence after indexed insert triggers", async () => {
  const observed = observeBatch();
  const response = await request("/intake", "POST", { title: "intakereceipttoken", teamId: ids.flow, summary: "evidencereceipttoken" }, observed.db);
  assert.equal(response.status, 201);
  const issue = await response.json() as any;
  assertIndexedReceipt(observed.receipts, issue.id);
  const stored = await state(issue.id);
  assert.equal(stored.issue!.version, 1);
  assert.equal(stored.activity.length, 1);
  assert.equal(await matches(issue.id, "intakereceipttoken AND evidencereceipttoken"), true);
});
