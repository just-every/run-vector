import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import assert from "node:assert/strict";
import { beforeAll, inject, it } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { createUlid } from "../../src/core/shared/ids";
import { testCookie } from "./native-fixture";

const app = createServerApp(),
  origin = "https://vector.test";
let cookie: string;
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00Z"));
  cookie = await testCookie(env.DB, ids.sarah);
});
async function request(
  path: string,
  body?: unknown,
  db = env.DB,
  method = "PATCH",
) {
  return app.request(
    origin + path,
    {
      method: body === undefined ? "GET" : method,
      headers: { origin, "content-type": "application/json", cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { ...env, DB: db, APP_ORIGIN: origin },
  );
}
async function create(extra: Record<string, unknown> = {}) {
  const result = await request(
    "/api/issues",
    { title: "Context fixture", teamId: ids.flow, ...extra },
    env.DB,
    "POST",
  );
  assert.equal(result.status, 201);
  return result.json() as Promise<any>;
}
async function patch(issue: any, values: Record<string, unknown>, db = env.DB) {
  return request(
    "/api/issues/" + issue.identifier,
    { expectedVersion: issue.version, ...values },
    db,
  );
}
async function receipt(id: string) {
  return {
    issue: await env.DB.prepare("SELECT * FROM issues WHERE id=?")
      .bind(id)
      .first(),
    labels: (
      await env.DB.prepare(
        "SELECT * FROM issue_labels WHERE issue_id=? ORDER BY label_id",
      )
        .bind(id)
        .all()
    ).results,
    activity: (
      await env.DB.prepare(
        "SELECT * FROM issue_activity WHERE issue_id=? ORDER BY id",
      )
        .bind(id)
        .all()
    ).results,
  };
}
function beforeBatch(action: () => Promise<void>) {
  let used = false;
  return new Proxy(env.DB, {
    get(target, property) {
      if (property === "batch")
        return async (writes: D1PreparedStatement[]) => {
          if (!used) {
            used = true;
            await action();
          }
          return target.batch(writes);
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

it("[ISSUE-002 ISSUE-006 ISSUE-007] native contextual PATCH atomically persists all fields, labels and actor history; clears nullable context", async () => {
  const issue = await create();
  const values = {
    projectId: ids.reliability,
    cycleId: ids.flowCycle,
    estimate: 100,
    dueDate: "2028-02-29",
    labelIds: [ids.reliabilityLabel, ids.customerLabel],
    expectedOutcome: "  Correct result  ",
    customerImpact: "  Better service  ",
    customFields: {
      nested: { array: [null, true, 3, { value: "text" }] },
      blank: null,
    },
    title: "Edited title",
    description: "Description",
    priority: "high",
    statusId: ids.flowStarted,
    assigneeOperatorId: ids.maya,
  };
  const result = await patch(issue, values);
  assert.equal(result.status, 200);
  const changed: any = await result.json();
  assert.equal(changed.version, 2);
  assert.equal(changed.project.id, values.projectId);
  assert.equal(changed.cycle.id, values.cycleId);
  assert.equal(changed.estimate, 100);
  assert.equal(changed.dueDate, values.dueDate);
  assert.equal(changed.expectedOutcome, "Correct result");
  assert.equal(changed.customerImpact, "Better service");
  assert.deepEqual(changed.customFields, values.customFields);
  assert.deepEqual(
    changed.labels.map((label: any) => label.id).sort(),
    values.labelIds.slice().sort(),
  );
  assert.equal(changed.title, values.title);
  assert.equal(changed.description, values.description);
  assert.equal(changed.status.id, ids.flowStarted);
  assert.equal(changed.assignee.id, ids.maya);
  const stored = await receipt(issue.id),
    activity: any = stored.activity.at(-1);
  assert.equal(stored.activity.length, 2);
  assert.equal(activity.actor_operator_id, ids.sarah);
  const prior = JSON.parse(activity.previous_value_json),
    next = JSON.parse(activity.next_value_json);
  assert.equal(prior.projectId, null);
  assert.deepEqual(prior.labelIds, []);
  assert.deepEqual(prior.customFields, {});
  assert.equal(next.expectedOutcome, "Correct result");
  assert.deepEqual(next.customFields, values.customFields);
  const cleared = await patch(changed, {
    projectId: null,
    cycleId: null,
    estimate: null,
    dueDate: null,
    labelIds: [],
    expectedOutcome: "   ",
    customerImpact: null,
    customFields: {},
    assigneeOperatorId: null,
  });
  assert.equal(cleared.status, 200);
  const clear: any = await cleared.json();
  for (const field of [
    "project",
    "cycle",
    "estimate",
    "dueDate",
    "expectedOutcome",
    "customerImpact",
    "assignee",
  ])
    assert.equal(clear[field], null);
  assert.deepEqual(clear.labels, []);
  assert.deepEqual(clear.customFields, {});
  assert.equal(clear.version, 3);
  assert.equal((await receipt(issue.id)).activity.length, 3);
  assert.deepEqual(
    await (await request("/api/issues/" + issue.identifier)).json(),
    clear,
  );
  const onlyLabels = await patch(clear, { labelIds: [ids.customerLabel] });
  assert.equal(onlyLabels.status, 200);
  const labelOnlyIssue: any = await onlyLabels.json();
  assert.equal(labelOnlyIssue.version, 4);
  assert.deepEqual(
    labelOnlyIssue.labels.map((label: any) => label.id),
    [ids.customerLabel],
  );
  assert.equal((await receipt(issue.id)).activity.length, 4);
});

it("[ISSUE-006 ISSUE-007] order-independent label/object no-op leaves version/history/timestamps; array ordering changes and stale PATCH retains current issue", async () => {
  const issue = await create({
    labelIds: [ids.customerLabel, ids.reliabilityLabel],
    customFields: { a: 1, b: { x: 2, y: [1, 2] } },
  });
  const before = await receipt(issue.id);
  const result = await patch(issue, {
    labelIds: [ids.reliabilityLabel, ids.customerLabel],
    customFields: { b: { y: [1, 2], x: 2 }, a: 1 },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(await receipt(issue.id), before);
  const changed = await patch(issue, {
    customFields: { a: 1, b: { x: 2, y: [2, 1] } },
  });
  assert.equal(changed.status, 200);
  assert.equal(((await changed.json()) as any).version, 2);
  const stale = await patch(issue, {
    labelIds: [],
    projectId: ids.reliability,
  });
  assert.equal(stale.status, 409);
  const conflict: any = await stale.json();
  assert.equal(conflict.error, "stale_version");
  assert.equal(conflict.version, 2);
  assert.deepEqual(conflict.issue.labels.map((label: any) => label.id).sort(), [
    ids.customerLabel,
    ids.reliabilityLabel,
  ]);
  assert.equal((await receipt(issue.id)).activity.length, 2);
});

it("[ISSUE-002] strict contextual API rejects malformed/unknown/foreign/closed/terminal choices without partial writes", async () => {
  const issue = await create(),
    before = await receipt(issue.id),
    foreign = createUlid(new Date()),
    label = createUlid(new Date()),
    project = createUlid(new Date()),
    archived = createUlid(new Date()),
    operator = createUlid(new Date());
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO workspace_settings VALUES(?,?,?,?,?)")
    .bind(foreign, "Other", "UTC", now, now)
    .run();
  await env.DB.prepare(
    "INSERT INTO labels(id,workspace_id,name,color,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  )
    .bind(label, foreign, "Foreign", "#000", now, now)
    .run();
  await env.DB.prepare(
    "INSERT INTO projects(id,workspace_id,name,lead_operator_id,lifecycle,created_at,updated_at) VALUES(?,?,?,?,'active',?,?)",
  )
    .bind(project, foreign, "Foreign", ids.sarah, now, now)
    .run();
  await env.DB.prepare(
    "INSERT INTO projects(id,workspace_id,name,lead_operator_id,lifecycle,archived_at,created_at,updated_at) VALUES(?,?,?,?,'active',?,?,?)",
  )
    .bind(archived, ids.workspace, "Archived fixture", ids.sarah, now, now, now)
    .run();
  await env.DB.prepare(
    "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  )
    .bind(
      operator,
      foreign,
      "Foreign operator",
      operator + "@example.test",
      now,
      now,
    )
    .run();
  const invalid = [
    { estimate: 0 },
    { estimate: 101 },
    { estimate: 1.5 },
    { dueDate: "2027-02-29" },
    { projectId: "short" },
    { projectId: "0".repeat(26) },
    { projectId: archived },
    { projectId: project },
    { assigneeOperatorId: operator },
    { cycleId: ids.platformCycle },
    { labelIds: [label] },
    { labelIds: [ids.customerLabel, ids.customerLabel] },
    {
      labelIds: Array.from({ length: 21 }, (_, n) =>
        String(n).padStart(26, "0"),
      ),
    },
    { expectedOutcome: "x".repeat(20001) },
    { customerImpact: "x".repeat(20001) },
    { customFields: [] },
    { unknown: true },
    { cycleId: ids.flowCycle, statusId: ids.flowCompleted },
    { cycleId: ids.flowCycle, statusId: ids.flowCanceled },
  ];
  for (const fields of invalid) {
    const result = await patch(issue, fields);
    assert.equal(result.status, 400, JSON.stringify(fields).slice(0, 120));
    assert.deepEqual(await receipt(issue.id), before);
  }
  await env.DB.prepare("UPDATE cycles SET closed_at=? WHERE id=?")
    .bind(now, ids.flowCycle)
    .run();
  try {
    assert.equal(
      (await patch(issue, { cycleId: ids.flowCycle, title: "must not write" }))
        .status,
      400,
    );
    assert.deepEqual(await receipt(issue.id), before);
  } finally {
    await env.DB.prepare("UPDATE cycles SET closed_at=NULL WHERE id=?")
      .bind(ids.flowCycle)
      .run();
  }
  const oversized = await patch(issue, {
    customFields: { large: "x".repeat(1048576) },
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(await receipt(issue.id), before);
});

it("[ISSUE-006] unchanged unavailable selections remain during unrelated edits; terminal cycle retention and uncommit are permitted", async () => {
  const issue = await create({
    projectId: ids.reliability,
    cycleId: ids.flowCycle,
    assigneeOperatorId: ids.maya,
    labelIds: [ids.customerLabel],
  });
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE projects SET archived_at=? WHERE id=?").bind(
      now,
      ids.reliability,
    ),
    env.DB.prepare("UPDATE cycles SET closed_at=? WHERE id=?").bind(
      now,
      ids.flowCycle,
    ),
    env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?").bind(
      now,
      ids.maya,
    ),
  ]);
  try {
    const result = await patch(issue, {
      title: "Historical context retained",
      projectId: ids.reliability,
      cycleId: ids.flowCycle,
      assigneeOperatorId: ids.maya,
      labelIds: [ids.customerLabel],
      statusId: ids.flowCompleted,
    });
    assert.equal(result.status, 200);
    const terminal: any = await result.json();
    assert.equal(terminal.cycle.id, ids.flowCycle);
    assert.equal(terminal.version, 2);
    assert.equal((await patch(terminal, { cycleId: null })).status, 200);
  } finally {
    await env.DB.batch([
      env.DB.prepare("UPDATE projects SET archived_at=NULL WHERE id=?").bind(
        ids.reliability,
      ),
      env.DB.prepare("UPDATE cycles SET closed_at=NULL WHERE id=?").bind(
        ids.flowCycle,
      ),
      env.DB.prepare("UPDATE operators SET removed_at=NULL WHERE id=?").bind(
        ids.maya,
      ),
    ]);
  }
});

it("[ISSUE-006 ISSUE-007] option archive/removal/closure between validation and actual D1 batch prevents every field/label/activity write", async () => {
  const cases = [
    {
      fields: { projectId: ids.reliability },
      sql: "UPDATE projects SET archived_at=? WHERE id=?",
      id: ids.reliability,
      restore: "UPDATE projects SET archived_at=NULL WHERE id=?",
    },
    {
      fields: { cycleId: ids.flowCycle },
      sql: "UPDATE cycles SET closed_at=? WHERE id=?",
      id: ids.flowCycle,
      restore: "UPDATE cycles SET closed_at=NULL WHERE id=?",
    },
    {
      fields: { assigneeOperatorId: ids.maya },
      sql: "UPDATE operators SET removed_at=? WHERE id=?",
      id: ids.maya,
      restore: "UPDATE operators SET removed_at=NULL WHERE id=?",
    },
  ];
  for (const entry of cases) {
    const issue = await create({ labelIds: [ids.customerLabel] }),
      before = await receipt(issue.id);
    try {
      const result = await patch(
        issue,
        {
          ...entry.fields,
          title: "Should not commit",
          labelIds: [ids.reliabilityLabel],
        },
        beforeBatch(async () => {
          await env.DB.prepare(entry.sql)
            .bind(new Date().toISOString(), entry.id)
            .run();
        }),
      );
      assert.equal(result.status, 400);
      assert.equal(((await result.json()) as any).error, "invalid_option");
      assert.deepEqual(await receipt(issue.id), before);
    } finally {
      await env.DB.prepare(entry.restore).bind(entry.id).run();
    }
  }
  const issue = await create({ labelIds: [ids.customerLabel] }),
    before = await receipt(issue.id),
    label = createUlid(new Date()),
    now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO labels VALUES(?,?,?,?,?,?)")
    .bind(label, ids.workspace, "Race label", "#000", now, now)
    .run();
  const result = await patch(
    issue,
    { title: "No deleted label", labelIds: [label] },
    beforeBatch(async () => {
      await env.DB.prepare("DELETE FROM labels WHERE id=?").bind(label).run();
    }),
  );
  assert.equal(result.status, 400);
  assert.deepEqual(await receipt(issue.id), before);
  const stale = await patch(
    issue,
    { title: "No overwrite", labelIds: [] },
    beforeBatch(async () => {
      await env.DB.prepare(
        "UPDATE issues SET version=version+1,title=? WHERE id=?",
      )
        .bind("Concurrent title", issue.id)
        .run();
    }),
  );
  assert.equal(stale.status, 409);
  const current: any = await stale.json();
  assert.equal(current.error, "stale_version");
  assert.equal(current.issue.title, "Concurrent title");
  assert.deepEqual((await receipt(issue.id)).labels, before.labels);
  assert.deepEqual((await receipt(issue.id)).activity, before.activity);
});

it("[ISSUE-006 BASE-DATA-002] actual D1 batch failure rolls back labels/metadata/activity, surfaces native failure and permits retry", async () => {
  const issue = await create({ labelIds: [ids.customerLabel] }),
    before = await receipt(issue.id);
  await env.DB.exec(
    "CREATE TRIGGER context_write_failure BEFORE UPDATE OF title ON issues BEGIN SELECT RAISE(ABORT,'synthetic context D1 failure'); END;",
  );
  try {
    const failed = await patch(issue, {
      title: "Retry after failure",
      projectId: ids.reliability,
      labelIds: [ids.reliabilityLabel],
    });
    assert.equal(failed.status, 500);
    assert.equal(((await failed.json()) as any).error, "internal_error");
    assert.deepEqual(await receipt(issue.id), before);
  } finally {
    await env.DB.exec("DROP TRIGGER context_write_failure;");
  }
  const retry = await patch(issue, {
    title: "Retry after failure",
    projectId: ids.reliability,
    labelIds: [ids.reliabilityLabel],
  });
  assert.equal(retry.status, 200);
  assert.equal(((await retry.json()) as any).version, 2);
  assert.equal((await receipt(issue.id)).activity.length, 2);
});
