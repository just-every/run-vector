import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import assert from "node:assert/strict";
import { beforeAll, inject, it } from "vitest";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { createUlid } from "../../src/core/shared/ids";
import { createIssueInputSchema } from "../../src/core/features/issues/input";
import { createIssueRecord } from "../../src/core/features/issues/repository";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import {
  getMyWorkStream,
  loadWorkspaceSnapshot,
} from "../../src/core/features/streams/service";
import { moveIssueTeamRecord } from "../../src/core/features/team-move/repository";

const now = new Date("2026-09-30T12:00:00.000Z");
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, now);
});

// Explicit D1 fixtures exercise live progress calculation; scheduled closure
// and authored commitment flows have their own public-door coverage.
async function cycle(capacity: number | null) {
  const id = createUlid(now);
  await env.DB.prepare(
    `INSERT INTO cycles(id,team_id,name,starts_at,ends_at,capacity,closed_at,created_at,updated_at)
     VALUES(?,?,?,?,?,?,NULL,?,?)`,
  )
    .bind(
      id,
      ids.flow,
      `Persisted progress ${id}`,
      "2026-09-29T23:00:00.000Z",
      "2026-10-01T16:00:00.000Z",
      capacity,
      now.toISOString(),
      now.toISOString(),
    )
    .run();
  return id;
}

async function committed(
  cycleId: string,
  estimate: number | null,
  statusId: string = ids.flowUnstarted,
  assignee: string | null = ids.sarah,
) {
  const issue = await createIssueRecord(env.DB, {
    actorOperatorId: ids.sarah,
    now,
    input: createIssueInputSchema.parse({
      title: "Persisted cycle calculation",
      teamId: ids.flow,
      cycleId,
      estimate,
      assigneeOperatorId: assignee,
      statusId: ids.flowUnstarted,
    }),
  });
  if (statusId !== ids.flowUnstarted) {
    await env.DB.prepare(
      "UPDATE issues SET status_id=?,completed_at=?,canceled_at=? WHERE identifier=?",
    )
      .bind(
        statusId,
        statusId === ids.flowCompleted ? now.toISOString() : null,
        statusId === ids.flowCanceled ? now.toISOString() : null,
        issue.identifier,
      )
      .run();
  }
  return issue.identifier;
}

async function row(cycleId: string, operatorId: string = ids.sarah) {
  const work = await getMyWorkStream(env.DB, operatorId, now);
  const result = work.cycles.find((item) => item.id === cycleId);
  assert.ok(result, `${cycleId} is eligible for this operator`);
  return result;
}

it("[WORK-003][CYCLE-003] original persistent sample reports all committed points and retains stream membership without mutating prior data", async () => {
  const before = await loadWorkspaceSnapshot(env.DB);
  const work = await getMyWorkStream(env.DB, ids.sarah, now);
  assert.deepEqual(
    work.sections.waiting.map((item) => item.identifier),
    ["PLT-102"],
  );
  assert.ok(work.sections.now.some((item) => item.identifier === "PLT-103"));
  assert.ok(work.sections.next.some((item) => item.identifier === "PLT-101"));
  const flow = work.cycles.find((item) => item.id === ids.flowCycle);
  const platform = work.cycles.find((item) => item.id === ids.platformCycle);
  assert.ok(flow);
  assert.ok(platform);
  assert.equal(work.cycles.length, 2);
  assert.deepEqual(
    {
      completed: flow.completed,
      total: flow.total,
      unit: flow.unit,
      percentage: flow.percentage,
      remainingPoints: flow.remainingPoints,
      capacityRisk: flow.capacityRisk,
      capacity: flow.capacity,
      unestimatedRemaining: flow.unestimatedRemaining,
    },
    {
      completed: 0,
      total: 13,
      unit: "points",
      percentage: 0,
      remainingPoints: 13,
      capacityRisk: "within-capacity",
      capacity: 18,
      unestimatedRemaining: 0,
    },
  );
  assert.equal(platform.total, 13);
  assert.equal(flow.timezone, "Australia/Brisbane");
  assert.equal(flow.startsAt, "2026-09-27T12:00:00.000Z");
  assert.equal(flow.endsAt, "2026-10-04T12:00:00.000Z");
  assert.deepEqual(await getMyWorkStream(env.DB, ids.sarah, now), work);
  assert.deepEqual(await loadWorkspaceSnapshot(env.DB), before);
});

it("[WORK-003][CYCLE-003] another assignee and unassigned scope change whole-cycle progress but not personal eligibility", async () => {
  const id = await cycle(7);
  const own = await committed(id, 3);
  await committed(id, 5, ids.flowCompleted, ids.maya);
  const other = await committed(id, 4, ids.flowStarted, null);
  await committed(id, null, ids.flowCanceled, ids.maya);
  await committed(id, 100, ids.flowDuplicate, ids.maya);
  const result = await row(id);
  assert.equal(result.completed, 5);
  assert.equal(result.total, 12);
  assert.equal(result.unit, "points");
  assert.equal(result.percentage, (5 / 12) * 100);
  assert.equal(result.remainingPoints, 7);
  assert.equal(result.capacityRisk, "within-capacity");
  const work = await getMyWorkStream(env.DB, ids.sarah, now);
  assert.ok(work.sections.next.some((issue) => issue.identifier === own));
  assert.equal(
    Object.values(work.sections)
      .flat()
      .some((issue) => issue.identifier === other),
    false,
  );
  assert.ok(await row(id, ids.maya));
  assert.equal(
    (await getMyWorkStream(env.DB, ids.alex, now)).cycles.some(
      (item) => item.id === id,
    ),
    false,
  );
  await env.DB.prepare("UPDATE cycles SET capacity=6 WHERE id=?")
    .bind(id)
    .run();
  assert.equal((await row(id)).capacityRisk, "at-risk");
});

it("[CYCLE-003] missing completed estimate uses counts while remaining points stay known; missing remaining estimate makes risk unknown", async () => {
  const id = await cycle(8);
  await committed(id, null, ids.flowCompleted, ids.maya);
  const remaining = await committed(id, 8, ids.flowBacklog);
  await committed(id, 3, ids.flowIntake, null);
  const known = await row(id);
  assert.equal(known.unit, "issue-count");
  assert.equal(known.completed, 1);
  assert.equal(known.total, 3);
  assert.equal(known.percentage, (1 / 3) * 100);
  assert.equal(known.remainingPoints, 11);
  assert.equal(known.capacityRisk, "at-risk");
  assert.equal(known.unestimatedRemaining, 0);
  await env.DB.prepare("UPDATE issues SET estimate=NULL WHERE identifier=?")
    .bind(remaining)
    .run();
  const unknown = await row(id);
  assert.equal(unknown.remainingPoints, null);
  assert.equal(unknown.unestimatedRemaining, 1);
  assert.equal(unknown.capacityRisk, "unknown");
  await env.DB.prepare("UPDATE issues SET estimate=8 WHERE identifier=?")
    .bind(remaining)
    .run();
  await env.DB.prepare("UPDATE cycles SET capacity=NULL WHERE id=?")
    .bind(id)
    .run();
  const absentCapacity = await row(id);
  assert.equal(absentCapacity.remainingPoints, 11);
  assert.equal(absentCapacity.capacity, null);
  assert.equal(absentCapacity.capacityRisk, "unknown");
});

it("[WORK-003][CYCLE-003] excluded assigned scope keeps an empty row and zero capacity is honored", async () => {
  const id = await cycle(0);
  const canceled = await committed(id, null, ids.flowCanceled);
  await committed(id, 100, ids.flowDuplicate, ids.maya);
  const empty = await row(id);
  assert.equal(empty.total, 0);
  assert.equal(empty.completed, 0);
  assert.equal(empty.percentage, null);
  assert.equal(empty.remainingPoints, 0);
  assert.equal(empty.unestimatedRemaining, 0);
  assert.equal(empty.capacity, 0);
  assert.equal(empty.capacityRisk, "within-capacity");
  await env.DB.prepare(
    "UPDATE issues SET status_id=?,estimate=1,canceled_at=NULL WHERE identifier=?",
  )
    .bind(ids.flowStarted, canceled)
    .run();
  const remaining = await row(id);
  assert.equal(remaining.total, 1);
  assert.equal(remaining.capacityRisk, "at-risk");
  await env.DB.prepare(
    "UPDATE issues SET status_id=?,completed_at=?,estimate=NULL WHERE identifier=?",
  )
    .bind(ids.flowCompleted, now.toISOString(), canceled)
    .run();
  const done = await row(id);
  assert.equal(done.unit, "issue-count");
  assert.equal(done.completed, 1);
  assert.equal(done.percentage, 100);
  assert.equal(done.capacityRisk, "within-capacity");
});

it("[WORK-003] future, ended, closed, removed and unassigned cycles stay ineligible; actual team moves remove cycle context", async () => {
  let id = await cycle(10);
  let issue = await committed(id, 5);
  const absent = async () =>
    assert.equal(
      (await getMyWorkStream(env.DB, ids.sarah, now)).cycles.some(
        (item) => item.id === id,
      ),
      false,
    );
  await env.DB.prepare("UPDATE cycles SET starts_at=? WHERE id=?")
    .bind("2026-10-01T12:00:00.000Z", id)
    .run();
  await absent();
  await env.DB.prepare("UPDATE cycles SET starts_at=?,ends_at=? WHERE id=?")
    .bind("2026-09-29T12:00:00.000Z", now.toISOString(), id)
    .run();
  await absent();
  await env.DB.prepare(
    "UPDATE cycles SET starts_at=?,ends_at=?,closed_at=? WHERE id=?",
  )
    .bind(now.toISOString(), "2026-10-01T12:00:00.000Z", now.toISOString(), id)
    .run();
  await absent();
  await assert.rejects(
    env.DB.prepare("UPDATE cycles SET closed_at=NULL WHERE id=?")
      .bind(id)
      .run(),
    /CYCLE_CLOSED/,
  );
  id = await cycle(10);
  issue = await committed(id, 5);
  await env.DB.prepare("UPDATE cycles SET starts_at=? WHERE id=?")
    .bind(now.toISOString(), id)
    .run();
  assert.ok(await row(id)); // A fresh cycle starts inclusively; closed cycles never reopen.
  await env.DB.prepare(
    "UPDATE issues SET assignee_operator_id=NULL WHERE identifier=?",
  )
    .bind(issue)
    .run();
  await absent();
  await env.DB.prepare(
    "UPDATE issues SET assignee_operator_id=? WHERE identifier=?",
  )
    .bind(ids.sarah, issue)
    .run();
  assert.equal(
    await moveIssueTeamRecord(
      env.DB,
      issue,
      ids.sarah,
      {
        expectedVersion: 1,
        teamId: ids.platform,
        statusId: ids.platformUnstarted,
      },
      now,
    ),
    "written",
  );
  await absent();
  const moved = await env.DB.prepare(
    "SELECT cycle_id,team_id FROM issues WHERE identifier=?",
  )
    .bind(issue)
    .first<{ cycle_id: string | null; team_id: string }>();
  assert.deepEqual(moved, { cycle_id: null, team_id: ids.platform });
  await committed(id, 1);
  await assert.rejects(
    env.DB.prepare("DELETE FROM cycles WHERE id=?").bind(id).run(),
    /FOREIGN KEY constraint failed/,
  );
  assert.ok(await row(id));
  await env.DB.prepare("UPDATE issues SET cycle_id=NULL WHERE cycle_id=?")
    .bind(id)
    .run();
  await env.DB.prepare("DELETE FROM cycles WHERE id=?").bind(id).run();
  await absent();
});
