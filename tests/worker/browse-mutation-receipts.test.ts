import { env } from "cloudflare:workers";
import assert from "node:assert/strict";
import { beforeAll, it } from "vitest";
import { createIssue, observeBatch, request, setup, state } from "./search-mutation-receipts-fixture";
import { assertDirectReceipt, decisionBody, history, ids, intake, retained, revision } from "./browse-mutation-fixture";

beforeAll(setup);

for (const kind of ["accept", "defer", "decline"] as const)
  it(`[INTAKE-005 INTAKE-006 INTAKE-007 VIEW-001] ${kind} reports its guarded native write despite browsing trigger writes`, async () => {
    const issue = await intake(), before = await state(issue.id), priorRevision = await revision();
    const observed = observeBatch(), body = decisionBody(kind);
    const response = await request(`/issues/${issue.identifier}/${kind}`, "POST", body, observed.db);
    assert.equal(response.status, 200);
    const dto = await response.json() as any;
    assert.equal(dto.version, 2);
    assert.equal(dto.status.category, kind === "accept" ? "unstarted" : kind === "decline" ? "canceled" : "intake");
    assert.equal(dto.deferredUntil, kind === "defer" ? body.returnAt : null);
    assertDirectReceipt(observed.receipts, "id", issue.id);
    assert.equal(await revision(), priorRevision + 1);
    const stored = await state(issue.id);
    assert.equal(stored.issue!.version, 2);
    assert.equal(stored.activity.length, before.activity.length + 1);
    assert.deepEqual(stored.activity.slice(0, -1), before.activity);
    assert.equal(stored.activity.at(-1)!.kind, `intake.${kind === "accept" ? "accepted" : kind === "defer" ? "deferred" : "declined"}`);
    assert.equal(dto.decisions.length, 1);
    const committed = await retained();
    assert.equal((await request(`/issues/${issue.identifier}/${kind}`, "POST", body)).status, 409);
    assert.deepEqual(await retained(), committed, "stale replay changes neither source, history nor revision");
  });

it("[ISSUE-006 ISSUE-007 VIEW-001] current-version no-op returns its exact issue and preserves history with revision triggers", async () => {
  const issue = await createIssue({ title: "No-op receipt", labelIds: [ids.customerLabel, ids.reliabilityLabel], customFields: { a: 1, b: 2 } });
  const before = await state(issue.id), priorRevision = await revision(), observed = observeBatch();
  const body = { expectedVersion: 1, title: "No-op receipt", labelIds: [ids.reliabilityLabel, ids.customerLabel], customFields: { b: 2, a: 1 } };
  const response = await request(`/issues/${issue.identifier}`, "PATCH", body, observed.db);
  assert.equal(response.status, 200);
  assert.equal((await response.json() as any).version, 1);
  assertDirectReceipt(observed.receipts, "identifier", issue.identifier);
  assert.equal(await revision(), priorRevision + 1);
  assert.deepEqual(await state(issue.id), before);
  const committed = await retained();
  assert.equal((await request(`/issues/${issue.identifier}`, "PATCH", { ...body, expectedVersion: 2 })).status, 409);
  assert.deepEqual(await retained(), committed);
});

it("[INTAKE-006 ISSUE-007 VIEW-001] already-returned no-op succeeds after a real return without another version or history event", async () => {
  const issue = await intake();
  assert.equal((await request(`/issues/${issue.identifier}/defer`, "POST", decisionBody("defer"))).status, 200);
  const deferredHistory = await history(issue.id), priorRevision = await revision();
  const response = await request(`/issues/${issue.identifier}/return`, "POST", { expectedVersion: 2 });
  assert.equal(response.status, 200);
  const dto = await response.json() as any;
  assert.equal(dto.version, 3);
  assert.equal(dto.deferredUntil, null);
  assert.equal(dto.activity.at(-1).kind, "intake.returned");
  assert.equal(await revision(), priorRevision + 1);
  const returnedHistory = await history(issue.id);
  assert.deepEqual(returnedHistory.intake_decisions, deferredHistory.intake_decisions);
  assert.deepEqual(returnedHistory.issue_deferral_origins, []);
  const before = await state(issue.id), observed = observeBatch();
  const noop = await request(`/issues/${issue.identifier}/return`, "POST", { expectedVersion: 3 }, observed.db);
  assert.equal(noop.status, 200);
  assert.equal((await noop.json() as any).version, 3);
  assertDirectReceipt(observed.receipts, "id", issue.id);
  assert.equal(await revision(), priorRevision + 2);
  assert.deepEqual(await state(issue.id), before);
  assert.deepEqual(await history(issue.id), returnedHistory);
  const committed = await retained();
  assert.equal((await request(`/issues/${issue.identifier}/return`, "POST", { expectedVersion: 2 })).status, 409);
  assert.deepEqual(await retained(), committed);
});

it("[OPS-003 VIEW-001] timezone save and repeated save return success from the native workspace mutation", async () => {
  const issue = await createIssue(), before = await state(issue.id);
  for (const timezone of ["Europe/Paris", "Europe/Paris", "UTC"]) {
    const priorRevision = await revision(), observed = observeBatch();
    const response = await request("/settings", "PATCH", { timezone }, observed.db);
    assert.equal(response.status, 200);
    assert.equal((await response.json() as any).workspace.timezone, timezone);
    assertDirectReceipt(observed.receipts, "id", ids.workspace);
    assert.equal(await revision(), priorRevision + 1);
    assert.equal(await env.DB.prepare("SELECT timezone FROM workspace_settings WHERE id=?").bind(ids.workspace).first("timezone"), timezone);
    assert.deepEqual(await state(issue.id), before);
  }
});

it("[REL-001 ISSUE-006 VIEW-001] dependency add/remove succeed and repeated operations leave source, history and revision untouched", async () => {
  const a = await createIssue(), b = await createIssue(), path = `/issues/${a.identifier}/dependencies`;
  for (const [method, version, error] of [["POST", 1, "dependency_exists"], ["DELETE", 2, "dependency_not_found"]] as const) {
    const body = { expectedVersion: version, relatedIdentifier: b.identifier, relatedVersion: version, direction: "blocks" };
    const priorRevision = await revision();
    const response = await request(path, method, body);
    assert.equal(response.status, 200);
    const dto = await response.json() as any;
    assert.equal(dto.issue.version, version + 1);
    assert.equal(dto.relatedIssue.version, version + 1);
    assert.equal(await revision(), priorRevision + 3);
    const committed = await retained();
    const repeated = await request(path, method, { ...body, expectedVersion: version + 1, relatedVersion: version + 1 });
    assert.equal(repeated.status, 409);
    assert.equal((await repeated.json() as any).error, error);
    assert.deepEqual(await retained(), committed);
  }
});
