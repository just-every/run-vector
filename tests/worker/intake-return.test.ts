import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import assert from "node:assert/strict";
import { beforeEach, inject, it } from "vitest";
import { createUlid } from "../../src/core/shared/ids";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import {
  returnDueIntake,
  endIntakeDeferral,
} from "../../src/core/features/intake-return/service";
import { writeIntakeDecision } from "../../src/core/features/issues/repository";
import {
  acceptIssueInputSchema,
  deferIssueInputSchema,
} from "../../src/core/features/issues/input";
import { IssueMutationError } from "../../src/core/features/issues/errors";

const now = new Date("2026-10-02T09:00:00.000Z");
const priorTitle =
  "[BASE-OPS-002] activity actor-name expansion preserves old actor/decision rows";
const fixtureIds: string[] = [];
let sequence = 200000;
beforeEach(async ({ task }) => {
  for (const id of fixtureIds.splice(0))
    await env.DB.prepare("DELETE FROM issues WHERE id=?").bind(id).run();
  const migrations = inject("migrations");
  await applyD1Migrations(
    env.DB,
    task.name === priorTitle ? migrations.slice(0, 8) : migrations,
  );
  await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00.000Z"));
});

async function intake(deferredUntil: string | null, status = ids.flowIntake) {
  const id = createUlid(new Date()),
    identifier = "FLW-" + sequence++;
  await env.DB.prepare(
    `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,deferred_until,version,created_at,updated_at)
    VALUES(?,?,'FLW',?,?,'Deferral fixture',?,'none',?,1,?,?)`,
  )
    .bind(
      id,
      identifier,
      sequence - 1,
      ids.flow,
      status,
      deferredUntil,
      now.toISOString(),
      now.toISOString(),
    )
    .run();
  fixtureIds.push(id);
  return { id, identifier };
}
function row(id: string) {
  return env.DB.prepare(
    "SELECT version,status_id,deferred_until,updated_at FROM issues WHERE id=?",
  )
    .bind(id)
    .first<any>();
}
async function returned(id: string) {
  return (
    await env.DB.prepare(
      "SELECT * FROM issue_activity WHERE issue_id=? AND kind='intake.returned' ORDER BY id",
    )
      .bind(id)
      .all<any>()
  ).results;
}
async function decide(
  file: { identifier: string },
  kind: "accepted" | "deferred",
  returnAt?: string,
) {
  const input =
    kind === "accepted"
      ? acceptIssueInputSchema.parse({
          expectedVersion: 1,
          statusId: ids.flowStarted,
          assigneeOperatorId: ids.maya,
        })
      : deferIssueInputSchema.parse({
          expectedVersion: 1,
          returnAt,
          reason: "New evidence window",
        });
  return writeIntakeDecision(env.DB, {
    actorOperatorId: ids.sarah,
    identifier: file.identifier,
    expectedVersion: 1,
    kind,
    input,
    now,
  });
}
function intercept(
  db: D1Database,
  predicate: (query: string) => boolean,
  action: () => Promise<void>,
  method: "all" | "run",
  afterRead = false,
) {
  let used = false;
  function statement(
    item: D1PreparedStatement,
    query: string,
  ): D1PreparedStatement {
    return new Proxy(item, {
      get(target, property) {
        if (property === "bind")
          return (...args: unknown[]) => statement(target.bind(...args), query);
        if (property === method)
          return async (...args: any[]) => {
            if (!used && predicate(query)) {
              used = true;
              if (afterRead) {
                const result = await (target[method] as any)(...args);
                await action();
                return result;
              }
              await action();
            }
            return (target[method] as any)(...args);
          };
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }
  return new Proxy(db, {
    get(target, property) {
      if (property === "prepare")
        return (query: string) => statement(target.prepare(query), query);
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

it(priorTitle, async () => {
  const activityBefore = (
    await env.DB.prepare("SELECT * FROM issue_activity ORDER BY id").all()
  ).results;
  const decisionsBefore = (
    await env.DB.prepare("SELECT * FROM intake_decisions ORDER BY id").all()
  ).results;
  await applyD1Migrations(env.DB, inject("migrations").slice(8));
  const activityAfter = (
    await env.DB.prepare("SELECT * FROM issue_activity ORDER BY id").all<any>()
  ).results;
  assert.deepEqual(
    activityAfter.map(({ actor_name, ...old }) => old),
    activityBefore,
  );
  assert.ok(activityAfter.every((a) => a.actor_name === null));
  assert.deepEqual(
    (await env.DB.prepare("SELECT * FROM intake_decisions ORDER BY id").all())
      .results,
    decisionsBefore,
  );
});

it("[INTAKE-006][ISSUE-006][ISSUE-007] returns due Intake by instant, preserves exact offset prior values/history and ignores future/non-Intake rows", async () => {
  const offset = "2026-10-02T10:00:00+02:00";
  const due = await intake(offset),
    boundary = await intake("2026-10-02T09:00:00Z");
  const future = await intake("2026-10-02T05:00:00-05:00"),
    invalid = await intake("not-a-time");
  const accepted = await intake("2026-10-01T00:00:00Z", ids.flowStarted);
  const at = "2026-09-30T00:00:00.000Z",
    decisionId = createUlid(new Date(at));
  await env.DB.prepare(
    "INSERT INTO intake_decisions(id,issue_id,actor_operator_id,kind,reason,return_at,created_at,updated_at) VALUES(?,?,?,'deferred',?,?,?,?)",
  )
    .bind(
      decisionId,
      due.id,
      ids.sarah,
      "Retain this original reason",
      offset,
      at,
      at,
    )
    .run();
  const decisionBefore = await env.DB.prepare(
    "SELECT * FROM intake_decisions WHERE id=?",
  )
    .bind(decisionId)
    .first();
  assert.deepEqual(await returnDueIntake(env, now), {
    processed: 2,
    returned: 2,
    skipped: 0,
  });
  for (const issue of [due, boundary]) {
    const current = await row(issue.id);
    assert.equal(current.version, 2);
    assert.equal(current.deferred_until, null);
    assert.equal(current.status_id, ids.flowIntake);
    const events = await returned(issue.id);
    assert.equal(events.length, 1);
    assert.equal(events[0].actor_operator_id, null);
    assert.equal(events[0].actor_name, "Deferral return automation");
    assert.deepEqual(JSON.parse(events[0].next_value_json), {
      deferredUntil: null,
    });
    assert.equal(events[0].created_at, now.toISOString());
  }
  assert.deepEqual(
    JSON.parse((await returned(due.id))[0].previous_value_json),
    { deferredUntil: offset },
  );
  assert.deepEqual(
    await env.DB.prepare("SELECT * FROM intake_decisions WHERE id=?")
      .bind(decisionId)
      .first(),
    decisionBefore,
  );
  for (const issue of [future, invalid, accepted]) {
    assert.equal((await row(issue.id)).version, 1);
    assert.equal((await returned(issue.id)).length, 0);
  }
  assert.deepEqual(await returnDueIntake(env, now), {
    processed: 0,
    returned: 0,
    skipped: 0,
  });
});

it("[INTAKE-006][ISSUE-006] automatic return never overwrites acceptance or a newer deferral selected after its due snapshot", async () => {
  for (const decision of ["accepted", "deferred"] as const) {
    const issue = await intake("2026-10-02T08:00:00Z");
    const future = "2026-10-03T09:00:00+00:00";
    const db = intercept(
      env.DB,
      (query) => query.includes("LIMIT 50"),
      async () => {
        assert.equal(
          (await decide(issue, decision, future)).outcome,
          "written",
        );
      },
      "all",
      true,
    );
    const result = await returnDueIntake({ DB: db }, now);
    assert.equal(result.returned, 0);
    assert.equal(result.skipped, 1);
    const current = await row(issue.id);
    assert.equal(current.version, 2);
    assert.equal(
      current.deferred_until,
      decision === "accepted" ? null : future,
    );
    assert.equal(
      current.status_id,
      decision === "accepted" ? ids.flowStarted : ids.flowIntake,
    );
    assert.equal((await returned(issue.id)).length, 0);
  }
});

it("[INTAKE-006][ISSUE-006][ISSUE-007] manual early return is attributed, version checked and a guarded semantic no-op after return", async () => {
  const original = "2026-10-04T09:00:00+00:00",
    issue = await intake(original);
  assert.equal(
    await endIntakeDeferral(env.DB, issue.identifier, ids.maya, 1, now),
    "written",
  );
  assert.equal((await row(issue.id)).version, 2);
  assert.equal((await row(issue.id)).deferred_until, null);
  const event = (await returned(issue.id))[0];
  assert.equal(event.actor_operator_id, ids.maya);
  assert.equal(event.actor_name, null);
  assert.deepEqual(JSON.parse(event.previous_value_json), {
    deferredUntil: original,
  });
  assert.equal(
    await endIntakeDeferral(env.DB, issue.identifier, ids.maya, 1, now),
    "stale",
  );
  assert.equal(
    await endIntakeDeferral(env.DB, issue.identifier, ids.maya, 2, now),
    "written",
  );
  assert.equal((await row(issue.id)).version, 2);
  assert.equal((await returned(issue.id)).length, 1);
  const alreadyReturned = await intake(null);
  const db = intercept(
    env.DB,
    (query) => query.includes("UPDATE issues SET version=version"),
    async () => {
      assert.equal(
        (await decide(alreadyReturned, "deferred", "2026-10-03T09:00:00Z"))
          .outcome,
        "written",
      );
    },
    "run",
  );
  assert.equal(
    await endIntakeDeferral(db, alreadyReturned.identifier, ids.maya, 1, now),
    "stale",
  );
  assert.equal(
    (await row(alreadyReturned.id)).deferred_until,
    "2026-10-03T09:00:00Z",
  );
  assert.equal((await returned(alreadyReturned.id)).length, 0);
  await assert.rejects(
    endIntakeDeferral(env.DB, "FLW-9999999", ids.maya, 1, now),
    (error) =>
      error instanceof IssueMutationError && error.code === "issue_not_found",
  );
  const notIntake = await intake(null, ids.flowStarted);
  await assert.rejects(
    endIntakeDeferral(env.DB, notIntake.identifier, ids.maya, 1, now),
    (error) =>
      error instanceof IssueMutationError &&
      error.code === "invalid_transition",
  );
});

it("[INTAKE-006][ISSUE-006] concurrent jobs append one event and bounded sweeps return all 51 due rows across repetitions", async () => {
  const jobs = [];
  for (let n = 0; n < 51; n++) jobs.push(await intake("2026-10-01T00:00:00Z"));
  const first = await returnDueIntake(env, now);
  assert.deepEqual(first, { processed: 50, returned: 50, skipped: 0 });
  const repeated = await Promise.all([
    returnDueIntake(env, now),
    returnDueIntake(env, now),
  ]);
  assert.equal(
    repeated.reduce((sum, result) => sum + result.returned, 0),
    1,
  );
  for (const issue of jobs) {
    assert.equal((await row(issue.id)).version, 2);
    assert.equal((await returned(issue.id)).length, 1);
  }
  assert.deepEqual(await returnDueIntake(env, now), {
    processed: 0,
    returned: 0,
    skipped: 0,
  });
});

it("[BASE-OPS-005] failed D1 return propagates without a partial version/history mutation", async () => {
  const issue = await intake("2026-10-01T00:00:00Z");
  const db = new Proxy(env.DB, {
    get(target, property) {
      if (property === "batch")
        return async () => {
          throw new Error("Injected D1 batch failure");
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(
    returnDueIntake({ DB: db }, now),
    /Injected D1 batch failure/,
  );
  assert.equal((await row(issue.id)).version, 1);
  assert.equal((await returned(issue.id)).length, 0);
  assert.deepEqual(await returnDueIntake(env, now), {
    processed: 1,
    returned: 1,
    skipped: 0,
  });
});
