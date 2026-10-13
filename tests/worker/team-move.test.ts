import { openCycleFixture } from "./open-cycle-fixture";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { Hono } from "hono";
import assert from "node:assert/strict";
import { beforeAll, inject, it } from "vitest";
import { createApiApp } from "../../src/core/app/api";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { createUlid } from "../../src/core/shared/ids";
import {
  sampleOwner,
  samplePeer,
  sampleSession,
  sampleBindings,
  origin,
} from "./sample-auth-fixture";
import { beforeCommit } from "./removal-interleaving";

// Use the real API admission/error middleware and registered native team route.
const api = createApiApp();
const app = new Hono().route("/api", api);
let cookie: string,
  sequence = 300000;
const timestamp = "2026-10-02T12:00:00.000Z";
const statuses = [
  ["intake", ids.flowIntake, ids.platformIntake],
  ["backlog", ids.flowBacklog, ids.platformBacklog],
  ["unstarted", ids.flowUnstarted, ids.platformUnstarted],
  ["started", ids.flowStarted, ids.platformStarted],
  ["completed", ids.flowCompleted, ids.platformCompleted],
  ["canceled", ids.flowCanceled, ids.platformCanceled],
  ["duplicate", ids.flowDuplicate, ids.platformDuplicate],
] as const;
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date(timestamp));
  cookie = await sampleOwner();
});
async function fixture(
  status: string = ids.flowBacklog,
  team: string = ids.flow,
) {
  const id = createUlid(new Date()),
    number = sequence++,
    identifier = "FLW-" + number;
  await env.DB.prepare(
    `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,description,status_id,priority,
    assignee_operator_id,project_id,cycle_id,due_date,estimate,expected_outcome,customer_impact,custom_fields_json,deferred_until,
    version,completed_at,canceled_at,created_at,updated_at)
    VALUES(?,?,'FLW',?,?,'Misrouted fixture','Original **description**',?,'high',?,?,?,'2026-10-10',13,'Outcome','Impact',?, ?,1,?,?,?,?)`,
  )
    .bind(
      id,
      identifier,
      number,
      team,
      status,
      ids.maya,
      ids.reliability,
      team === ids.flow ? ids.flowCycle : null,
      JSON.stringify({ nested: { value: [null, 3, "preserve"] } }),
      status === ids.flowIntake ? "2026-10-10T12:00:00.000Z" : null,
      status === ids.flowCompleted ? timestamp : null,
      status === ids.flowCanceled ? timestamp : null,
      timestamp,
      timestamp,
    )
    .run();
  return { id, identifier, version: 1 };
}
async function request(
  issue: { identifier: string; version: number },
  values: unknown,
  db = env.DB,
  headers: Record<string, string> = {},
  raw?: string,
) {
  return app.request(
    origin + "/api/issues/" + issue.identifier + "/team",
    {
      method: "POST",
      headers: {
        host: new URL(origin).host,
        origin,
        cookie,
        "content-type": "application/json",
        ...headers,
      },
      body: raw ?? JSON.stringify(values),
    },
    { ...sampleBindings, DB: db },
  );
}
function move(
  issue: { identifier: string; version: number },
  teamId: string = ids.platform,
  statusId: string = ids.platformBacklog,
  db = env.DB,
) {
  return request(
    issue,
    { expectedVersion: issue.version, teamId, statusId },
    db,
  );
}
async function receipt(id: string) {
  return {
    issue: await env.DB.prepare("SELECT * FROM issues WHERE id=?")
      .bind(id)
      .first<any>(),
    activity: (
      await env.DB.prepare(
        "SELECT * FROM issue_activity WHERE issue_id=? ORDER BY id",
      )
        .bind(id)
        .all<any>()
    ).results,
  };
}
function beforeBatch(action: () => Promise<void>) {
  return beforeCommit(
    (sql) => sql.includes("UPDATE issues SET team_id="),
    action,
  );
}

it("[ISSUE-012 ISSUE-002 ISSUE-006 ISSUE-007] native move preserves every workflow category including deferred Intake and terminal timestamps with one immutable actor entry", async () => {
  const allocations = (
    await env.DB.prepare(
      "SELECT * FROM team_issue_sequences ORDER BY team_id",
    ).all()
  ).results;
  for (const [category, source, target] of statuses) {
    const issue = await fixture(source),
      before = await receipt(issue.id);
    const response = await move(issue, ids.platform, target);
    assert.equal(response.status, 200, category);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body: any = await response.json();
    assert.equal(body.identifier, issue.identifier);
    assert.equal(body.team.id, ids.platform);
    assert.equal(body.status.id, target);
    assert.equal(body.status.category, category);
    assert.equal(body.cycle, null);
    assert.equal(body.version, 2);
    const after = await receipt(issue.id);
    const retained = {
      ...after.issue,
      team_id: before.issue.team_id,
      status_id: before.issue.status_id,
      cycle_id: before.issue.cycle_id,
      version: before.issue.version,
      updated_at: before.issue.updated_at,
    };
    assert.deepEqual(retained, before.issue);
    assert.equal(after.activity.length, 1);
    const activity = after.activity[0];
    assert.equal(activity.actor_operator_id, ids.sarah);
    assert.equal(activity.kind, "issue.team_moved");
    assert.deepEqual(JSON.parse(activity.previous_value_json), {
      teamId: ids.flow,
      statusId: source,
      cycleId: ids.flowCycle,
    });
    assert.deepEqual(JSON.parse(activity.next_value_json), {
      teamId: ids.platform,
      statusId: target,
      cycleId: null,
    });
    if (category === "intake")
      assert.equal(body.deferredUntil, before.issue.deferred_until);
    if (category === "completed") assert.equal(body.completedAt, timestamp);
    if (category === "canceled") assert.equal(body.canceledAt, timestamp);
    const noop = await move({ ...issue, version: 2 }, ids.platform, target);
    assert.equal(noop.status, 200);
    assert.deepEqual(await receipt(issue.id), after);
  }
  assert.deepEqual(
    (
      await env.DB.prepare(
        "SELECT * FROM team_issue_sequences ORDER BY team_id",
      ).all()
    ).results,
    allocations,
  );
});

it("[ISSUE-012 ISSUE-006] same-team/same-status current-version no-op retains cycle; same-team status changes and stale writes never move", async () => {
  const issue = await fixture(),
    before = await receipt(issue.id);
  assert.equal((await move(issue, ids.flow, ids.flowBacklog)).status, 200);
  assert.deepEqual(await receipt(issue.id), before);
  const transition = await move(issue, ids.flow, ids.flowStarted);
  assert.equal(transition.status, 400);
  assert.equal(((await transition.json()) as any).error, "invalid_option");
  assert.deepEqual(await receipt(issue.id), before);
  assert.equal((await move(issue)).status, 200);
  const after = await receipt(issue.id),
    stale = await move(issue, ids.flow, ids.flowBacklog);
  assert.equal(stale.status, 409);
  const conflict: any = await stale.json();
  assert.equal(conflict.error, "stale_version");
  assert.equal(conflict.version, 2);
  assert.equal(conflict.issue.team.id, ids.platform);
  assert.deepEqual(await receipt(issue.id), after);
});

it("[ISSUE-012 BASE-ACCESS-001] native session, Origin, canonical identifier, strict body and bounded JSON protect the operation", async () => {
  const issue = await fixture(),
    before = await receipt(issue.id),
    input = {
      expectedVersion: 1,
      teamId: ids.platform,
      statusId: ids.platformBacklog,
    };
  assert.equal(
    (await request(issue, input, env.DB, { cookie: "" })).status,
    401,
  );
  assert.equal(
    (await request(issue, input, env.DB, { origin: "https://foreign.test" }))
      .status,
    403,
  );
  assert.equal(
    (await request({ ...issue, identifier: "flw-1" }, input)).status,
    400,
  );
  for (const invalid of [
    { teamId: ids.platform, statusId: ids.platformBacklog },
    { ...input, expectedVersion: 0 },
    { ...input, statusId: null },
    { ...input, teamId: "bad" },
    { ...input, extra: true },
  ])
    assert.equal((await request(issue, invalid)).status, 400);
  assert.equal(
    (await request(issue, input, env.DB, {}, "{broken")).status,
    400,
  );
  assert.equal(
    (
      await request(
        issue,
        input,
        env.DB,
        {},
        JSON.stringify({ ...input, large: "x".repeat(1048576) }),
      )
    ).status,
    413,
  );
  assert.equal(
    (await request(issue, input, env.DB, { "content-type": "text/plain" }))
      .status,
    400,
  );
  assert.deepEqual(await receipt(issue.id), before);
});

it("[ISSUE-012 OPS-001] foreign issues are concealed before stale/option responses; foreign and archived target teams cannot commit", async () => {
  const workspace = createUlid(new Date()),
    team = createUlid(new Date()),
    status = createUlid(new Date()),
    now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)")
    .bind(workspace, "Foreign workspace", "UTC", now, now)
    .run();
  await env.DB.prepare(
    "INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  )
    .bind(team, workspace, "Foreign team", "FRN", now, now)
    .run();
  await env.DB.prepare("INSERT INTO workflow_statuses VALUES(?,?,?,?,?,?,?)")
    .bind(status, team, "Foreign backlog", "backlog", 0, now, now)
    .run();
  const foreign = await fixture(status, team),
    foreignBefore = await receipt(foreign.id);
  try {
    const concealed = await move(
      { ...foreign, version: 99 },
      ids.platform,
      ids.platformBacklog,
    );
    assert.equal(concealed.status, 404);
    const hidden = await concealed.text();
    assert.equal(hidden.includes(foreign.identifier), false);
    assert.equal(hidden.includes("Misrouted"), false);
    assert.deepEqual(await receipt(foreign.id), foreignBefore);
    const issue = await fixture(),
      before = await receipt(issue.id);
    assert.equal((await move(issue, team, status)).status, 400);
    assert.equal((await move(issue, "0".repeat(26))).status, 400);
    assert.equal(
      (await move(issue, ids.platform, ids.flowBacklog)).status,
      400,
    );
    assert.equal(
      (await move(issue, ids.platform, ids.platformStarted)).status,
      400,
    );
    await env.DB.prepare("UPDATE teams SET archived_at=? WHERE id=?")
      .bind(now, ids.platform)
      .run();
    try {
      assert.equal((await move(issue)).status, 400);
      assert.deepEqual(await receipt(issue.id), before);
    } finally {
      await env.DB.prepare("UPDATE teams SET archived_at=NULL WHERE id=?")
        .bind(ids.platform)
        .run();
    }
  } finally {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM issues WHERE id=?").bind(foreign.id),
      env.DB.prepare("DELETE FROM workflow_statuses WHERE id=?").bind(status),
      env.DB.prepare("DELETE FROM team_issue_history WHERE team_id=?").bind(
        team,
      ),
      env.DB.prepare("DELETE FROM team_issue_sequences WHERE team_id=?").bind(
        team,
      ),
      env.DB.prepare("DELETE FROM teams WHERE id=?").bind(team),
      env.DB.prepare(
        "DELETE FROM issue_prefix_sequences WHERE workspace_id=?",
      ).bind(workspace),
      env.DB.prepare("DELETE FROM workspace_settings WHERE id=?").bind(
        workspace,
      ),
    ]);
  }
});

it("[ISSUE-012 ISSUE-007] graph/evidence/assertions/history/original file bytes and closed source-cycle records survive movement unchanged", async () => {
  const issue = await fixture(ids.flowIntake),
    other = await fixture(),
    now = new Date().toISOString();
  const evidence = createUlid(new Date()),
    decision = createUlid(new Date()),
    history = createUlid(new Date()),
    comment = createUlid(new Date()),
    link = createUlid(new Date()),
    file = createUlid(new Date()),
    key = "team-move/" + file;
  const closedCycle = await openCycleFixture(env.DB, ids.flowCycle);
  await env.FILES.put(key, "Original private bytes");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO issue_labels VALUES(?,?,?)").bind(
      issue.id,
      ids.customerLabel,
      now,
    ),
    env.DB.prepare("INSERT INTO issue_dependencies VALUES(?,?,?)").bind(
      issue.id,
      other.id,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO evidence_revisions(id,issue_id,source_name,observed_at,received_at,summary,measurements_json,assertions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      evidence,
      issue.id,
      "Preserved source",
      timestamp,
      timestamp,
      "Evidence",
      JSON.stringify({ lag: 3 }),
      JSON.stringify({ priority: "urgent", unverified: "preserve" }),
      timestamp,
      timestamp,
    ),
    env.DB.prepare("INSERT INTO intake_decisions VALUES(?,?,?,?,?,?,?,?)").bind(
      decision,
      issue.id,
      ids.sarah,
      "deferred",
      "Prior decision",
      "2026-10-10T12:00:00.000Z",
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,'intake.deferred',?,?,?,?)`,
    ).bind(
      history,
      issue.id,
      ids.sarah,
      '{"deferredUntil":null}',
      '{"deferredUntil":"2026-10-10T12:00:00.000Z"}',
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    ).bind(
      comment,
      issue.id,
      ids.maya,
      "Preserve **comment**",
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      "INSERT INTO issue_links(id,issue_id,comment_id,actor_operator_id,name,url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
    ).bind(
      link,
      issue.id,
      comment,
      ids.maya,
      "Reference",
      "https://example.test/source",
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      `INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'ready',?,?)`,
    ).bind(
      file,
      issue.id,
      ids.sarah,
      "original.txt",
      "text/plain",
      22,
      key,
      timestamp,
      timestamp,
    ),
    env.DB.prepare("UPDATE issues SET cycle_id=? WHERE id=?").bind(
      closedCycle,
      issue.id,
    ),
    env.DB.prepare("UPDATE cycles SET closed_at=? WHERE id=?").bind(
      timestamp,
      closedCycle,
    ),
  ]);
  const tables = [
    "issue_labels",
    "issue_dependencies",
    "evidence_revisions",
    "intake_decisions",
    "issue_comments",
    "issue_links",
    "issue_files",
    "cycles",
    "team_issue_sequences",
  ];
  async function graph() {
    return Promise.all(
      tables.map(async (table) => ({
        table,
        rows: (
          await env.DB.prepare(
            "SELECT * FROM " + table + " ORDER BY rowid",
          ).all()
        ).results,
      })),
    );
  }
  const graphBefore = await graph(),
    before = await receipt(issue.id);
  try {
    const response = await move(issue, ids.platform, ids.platformIntake);
    assert.equal(response.status, 200);
    const dto: any = await response.json();
    assert.equal(dto.evidence[0].assertions.unverified, "preserve");
    assert.equal(dto.decisions[0].reason, "Prior decision");
    assert.equal(dto.dependencies[0].identifier, other.identifier);
    assert.deepEqual(await graph(), graphBefore);
    const after = await receipt(issue.id);
    assert.equal(after.activity.length, before.activity.length + 1);
    assert.deepEqual(
      after.activity.find((row) => row.id === history),
      before.activity[0],
    );
    assert.equal(
      await (await env.FILES.get(key))?.text(),
      "Original private bytes",
    );
  } finally {
    await env.FILES.delete(key);
  }
});

it("[ISSUE-012 ISSUE-006 OPS-004] real target/status/actor races reject at commit; stale version returns current without partial history", async () => {
  for (const race of [
    "archive",
    "status_category",
    "actor_removed",
    "actor_workspace",
    "version",
  ] as const) {
    const ownerCookie = cookie;
    const peer = await samplePeer(ownerCookie);
    cookie = peer.cookie;
    await sampleSession(cookie);
    const workspace = createUlid(new Date());
    let fired = 0;
    const issue = await fixture(),
      before = await receipt(issue.id);
    const db = beforeBatch(async () => {
      fired++;
      if (race === "archive")
        await env.DB.prepare("UPDATE teams SET archived_at=? WHERE id=?")
          .bind(timestamp, ids.platform)
          .run();
      if (race === "status_category")
        await env.DB.prepare(
          "UPDATE workflow_statuses SET category='started' WHERE id=?",
        )
          .bind(ids.platformBacklog)
          .run();
      if (race === "actor_removed")
        await env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
          .bind(timestamp, peer.id)
          .run();
      if (race === "actor_workspace") {
        await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)")
          .bind(
            workspace,
            "Actor moved " + workspace,
            "UTC",
            timestamp,
            timestamp,
          )
          .run();
        await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
          .bind(workspace, peer.id)
          .run();
      }
      if (race === "version")
        await env.DB.prepare(
          "UPDATE issues SET version=version+1,title=? WHERE id=?",
        )
          .bind("Concurrent edit", issue.id)
          .run();
    });
    try {
      const response = await move(issue, ids.platform, ids.platformBacklog, db);
      assert.equal(
        response.status,
        race === "actor_removed"
          ? 401
          : race === "actor_workspace"
            ? 404
            : race === "version"
              ? 409
              : 400,
        race,
      );
      assert.equal(fired, 1);
      const result: any = await response.json(),
        after = await receipt(issue.id);
      assert.deepEqual(after.activity, before.activity);
      if (race === "version") {
        assert.equal(result.error, "stale_version");
        assert.equal(result.version, 2);
        assert.equal(result.issue.title, "Concurrent edit");
        assert.equal(after.issue.team_id, ids.flow);
        assert.equal(after.issue.cycle_id, ids.flowCycle);
      } else assert.deepEqual(after.issue, before.issue);
    } finally {
      await env.DB.batch([
        env.DB.prepare("UPDATE teams SET archived_at=NULL WHERE id=?").bind(
          ids.platform,
        ),
        env.DB.prepare(
          "UPDATE workflow_statuses SET category='backlog' WHERE id=?",
        ).bind(ids.platformBacklog),
        env.DB.prepare(
          "UPDATE operators SET removed_at=NULL,workspace_id=? WHERE id=?",
        ).bind(ids.workspace, peer.id),
      ]);
      if (race === "actor_workspace")
        await env.DB.prepare("DELETE FROM workspace_settings WHERE id=?")
          .bind(workspace)
          .run();
      if (race === "actor_removed") await sampleSession(cookie, 401);
      cookie = ownerCookie;
      await sampleSession(cookie);
    }
  }
});

it("[ISSUE-012 BASE-DATA-002] actual D1 update failure rolls back activity and move; repeated concurrent requests record one move", async () => {
  const issue = await fixture(),
    before = await receipt(issue.id);
  await env.DB.exec(
    "CREATE TRIGGER team_move_write_failure BEFORE UPDATE OF team_id ON issues BEGIN SELECT RAISE(ABORT,'synthetic team move D1 failure'); END;",
  );
  try {
    const failure = await move(issue);
    assert.equal(failure.status, 500);
    assert.equal(((await failure.json()) as any).error, "internal_error");
    assert.deepEqual(await receipt(issue.id), before);
  } finally {
    await env.DB.exec("DROP TRIGGER team_move_write_failure;");
  }
  const responses = await Promise.all([move(issue), move(issue)]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );
  const after = await receipt(issue.id);
  assert.equal(after.issue.version, 2);
  assert.equal(after.activity.length, 1);
  assert.equal(after.issue.team_id, ids.platform);
});
