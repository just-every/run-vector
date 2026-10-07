import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import assert from "node:assert/strict";
import { beforeAll, inject, it } from "vitest";
import {
  buildVectorSample,
  vectorSampleIds as ids,
} from "../../sample-data/vector";
import { insertSampleData } from "../../src/core/features/sample-data/repository";
import { loadWorkspaceSnapshot } from "../../src/core/features/streams/repository";

beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await insertSampleData(
    env.DB,
    buildVectorSample(new Date("2026-09-30T12:00:00.000Z")),
  );
});
const sequences = async () =>
  (
    await env.DB.prepare(
      "SELECT * FROM team_issue_sequences ORDER BY team_id",
    ).all()
  ).results;

it("[ISSUE-002 BASE-OPS-002] a cold bootstrap keeps existing allocation numbers and timestamps plus every prior record", async () => {
  await env.DB.prepare(
    "UPDATE team_issue_sequences SET last_sequence=1000,updated_at=? WHERE team_id=?",
  )
    .bind("2026-10-02T10:00:00.000Z", ids.flow)
    .run();
  const before = await sequences(),
    graph = await loadWorkspaceSnapshot(env.DB);
  await insertSampleData(
    env.DB,
    buildVectorSample(new Date("2026-10-02T12:00:00.000Z")),
  );
  assert.deepEqual(await sequences(), before);
  assert.deepEqual(await loadWorkspaceSnapshot(env.DB), graph);
  await insertSampleData(
    env.DB,
    buildVectorSample(new Date("2026-10-03T12:00:00.000Z")),
  );
  assert.deepEqual(await sequences(), before);
  assert.deepEqual(await loadWorkspaceSnapshot(env.DB), graph);
});

it("[ISSUE-002] bootstrap may raise a retained allocation floor but never rewrites its equal or higher receipt", async () => {
  await env.DB.prepare(
    "UPDATE team_issue_sequences SET last_sequence=1,updated_at=? WHERE team_id=?",
  )
    .bind("2026-01-01T00:00:00.000Z", ids.flow)
    .run();
  await insertSampleData(
    env.DB,
    buildVectorSample(new Date("2026-10-02T12:00:00.000Z")),
  );
  const raised = await env.DB.prepare(
    "SELECT * FROM team_issue_sequences WHERE team_id=?",
  )
    .bind(ids.flow)
    .first<any>();
  assert.equal(raised.last_sequence, 842);
  assert.notEqual(raised.updated_at, "2026-01-01T00:00:00.000Z");
  await insertSampleData(
    env.DB,
    buildVectorSample(new Date("2026-10-03T12:00:00.000Z")),
  );
  assert.deepEqual(
    await env.DB.prepare("SELECT * FROM team_issue_sequences WHERE team_id=?")
      .bind(ids.flow)
      .first(),
    raised,
  );
});
