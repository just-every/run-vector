import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import assert from "node:assert/strict";
import { beforeAll, inject, it } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { createOperatorIntake } from "../../src/core/features/operator-intake/repository";
import { operatorIntakeInputSchema } from "../../src/core/features/operator-intake/input";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import {
  sampleOwner,
  samplePeer,
  sampleSession,
  sampleBindings,
  origin,
} from "./sample-auth-fixture";
const app = createServerApp();
let ownerCookie: string;
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date("2026-08-31T12:00:00Z"));
  ownerCookie = await sampleOwner();
});
async function request(path: string, body?: unknown, cookie?: string) {
  return app.request(
    origin + path,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        host: new URL(origin).host,
        origin,
        "content-type": "application/json",
        cookie: cookie ?? ownerCookie,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    sampleBindings,
  );
}
it("[INTAKE-001 ISSUE-002] native operator intake commits issue, attributed evidence and activity together; defaults descriptive fields and appears in Needs decision", async () => {
  const result = await request("/api/intake", {
    title: "Operator customer report",
    teamId: ids.flow,
    description: "**Observed locally**",
    observedAt: "2026-09-30T10:00:00+10:00",
    summary: "Repeated queue delay",
    link: "https://example.test/report",
    measurements: { delaySeconds: 45, affected: true },
    customerReports: [
      {
        customer: "Synthetic customer",
        summary: "Delay twice",
        link: "https://example.test/customer",
      },
    ],
  });
  assert.equal(result.status, 201);
  const issue: any = await result.json();
  assert.equal(issue.identifier, "FLW-843");
  assert.equal(issue.status.category, "intake");
  assert.equal(issue.version, 1);
  assert.deepEqual(issue.evidence[0], {
    id: issue.evidence[0].id,
    sourceName: "Operator report",
    originKind: "operator",
    actor: "Sarah Chen",
    link: "https://example.test/report",
    customerReports: [
      {
        customer: "Synthetic customer",
        summary: "Delay twice",
        link: "https://example.test/customer",
      },
    ],
    observedAt: "2026-09-30T00:00:00.000Z",
    receivedAt: issue.createdAt,
    summary: "Repeated queue delay",
    measurements: { delaySeconds: 45, affected: true },
    assertions: {},
    sourceId: null,
    sourceRecordId: null,
    sourceRevisionId: null,
    changes: [],
  });
  assert.equal(issue.activity.length, 1);
  assert.equal(issue.activity[0].actor, "Sarah Chen");
  const current: any = await (await request("/api/current")).json();
  assert.ok(
    current.sections["needs-decision"].some(
      (row: any) => row.identifier === issue.identifier,
    ),
  );
  const second: any = await (
    await request("/api/intake", {
      title: "Minimal operator report",
      teamId: ids.flow,
    })
  ).json();
  assert.equal(second.identifier, "FLW-844");
  assert.equal(second.evidence[0].summary, second.title);
  assert.equal(second.evidence[0].observedAt, second.createdAt);
  assert.deepEqual(second.evidence[0].assertions, {});
  const detail: any = await (
    await request("/api/issues/" + issue.identifier)
  ).json();
  assert.deepEqual(detail, issue);
});
it("[INTAKE-005 INTAKE-006 INTAKE-007 ISSUE-006] actual operator-created intake accepts, defers/returns early and declines with durable versioned history", async () => {
  const issue: any = await (
    await request("/api/intake", {
      title: "Deferred then declined report",
      teamId: ids.flow,
    })
  ).json();
  const returnAt = new Date(Date.now() + 3600000).toISOString();
  const deferred: any = await (
    await request(`/api/issues/${issue.identifier}/defer`, {
      expectedVersion: 1,
      returnAt,
      reason: "Wait for evidence",
    })
  ).json();
  assert.equal(deferred.version, 2);
  const returned = await request(`/api/issues/${issue.identifier}/return`, {
    expectedVersion: 2,
  });
  assert.equal(returned.status, 200);
  const body: any = await returned.json();
  assert.equal(body.version, 3);
  assert.equal(body.deferredUntil, null);
  assert.equal(body.decisions[0].returnAt, returnAt);
  assert.equal(body.activity.at(-1).kind, "intake.returned");
  assert.equal(body.activity.at(-1).actor, "Sarah Chen");
  assert.equal(
    (
      await request(`/api/issues/${issue.identifier}/return`, {
        expectedVersion: 2,
      })
    ).status,
    409,
  );
  const noop: any = await (
    await request(`/api/issues/${issue.identifier}/return`, {
      expectedVersion: 3,
    })
  ).json();
  assert.equal(noop.version, 3);
  assert.equal(noop.activity.length, 3);
  const declined: any = await (
    await request(`/api/issues/${issue.identifier}/decline`, {
      expectedVersion: 3,
      reason: "Already addressed",
    })
  ).json();
  assert.equal(declined.status.category, "canceled");
  assert.equal(declined.version, 4);
  assert.equal(declined.evidence.length, 1);
  assert.equal(declined.decisions.length, 2);
  const accepted: any = await (
    await request("/api/intake", {
      title: "Accepted operator report",
      teamId: ids.flow,
    })
  ).json();
  assert.equal(
    (
      await request(`/api/issues/${accepted.identifier}/accept`, {
        expectedVersion: 1,
        assigneeOperatorId: ids.maya,
      })
    ).status,
    200,
  );
});
it("[BASE-ACCESS-002 INTAKE-001] denies missing native session, spoofed identities and unsafe descriptive data without writing", async () => {
  const before = await env.DB.prepare(
    "SELECT count(*) AS n FROM issues",
  ).first();
  const noSession = await app.request(
    origin + "/api/intake",
    {
      method: "POST",
      headers: {
        host: new URL(origin).host,
        origin,
        "content-type": "application/json",
        "x-vector-operator-id": ids.sarah,
      },
      body: JSON.stringify({ title: "Spoof", teamId: ids.flow }),
    },
    sampleBindings,
  );
  assert.equal(noSession.status, 401);
  for (const extra of [
    { actorOperatorId: ids.maya },
    { measurements: { delay: 1, " delay ": 2 } },
    { sourceId: "claimed-policy" },
    { assertions: { recommendation: "Invented" } },
    { link: "javascript:alert(1)" },
    { customerReports: [{ summary: "Bad", link: "http://example.test" }] },
    {
      measurements: Object.fromEntries(
        Array.from({ length: 51 }, (_, i) => ["k" + i, i]),
      ),
    },
  ])
    assert.equal(
      (
        await request("/api/intake", {
          title: "Invalid report",
          teamId: ids.flow,
          ...extra,
        })
      ).status,
      400,
    );
  assert.deepEqual(
    await env.DB.prepare("SELECT count(*) AS n FROM issues").first(),
    before,
  );
});
it("[BASE-OPS-002 INTAKE-001] real D1 evidence failure rolls back issue/activity; allocated identifier remains consumed", async () => {
  await env.DB.exec(
    "CREATE TRIGGER reject_operator_evidence BEFORE INSERT ON evidence_revisions WHEN NEW.origin_kind='operator' BEGIN SELECT RAISE(ABORT,'synthetic evidence fault'); END;",
  );
  const before = await env.DB.prepare(
    "SELECT count(*) AS n FROM issues",
  ).first();
  const sequenceBefore = await env.DB.prepare(
    "SELECT last_sequence AS n FROM team_issue_sequences WHERE team_id=?",
  )
    .bind(ids.flow)
    .first<{ n: number }>();
  const response = await request("/api/intake", {
    title: "Storage failure",
    teamId: ids.flow,
  });
  assert.equal(response.status, 503);
  assert.deepEqual(
    await env.DB.prepare("SELECT count(*) AS n FROM issues").first(),
    before,
  );
  assert.equal(
    await env.DB.prepare(
      "SELECT id FROM issue_activity WHERE next_value_json LIKE '%Storage failure%'",
    ).first(),
    null,
  );
  await env.DB.exec("DROP TRIGGER reject_operator_evidence;");
  const next: any = await (
    await request("/api/intake", {
      title: "Storage recovered",
      teamId: ids.flow,
    })
  ).json();
  assert.equal(next.identifier, `FLW-${sequenceBefore!.n + 2}`);
});
it("[INTAKE-001] mutation-time eligibility guard prevents issue/evidence after team archival or removed actor", async () => {
  const input = operatorIntakeInputSchema.parse({
    title: "Race against archive",
    teamId: ids.flow,
  });
  const wrapped = new Proxy(env.DB, {
    get(target, key) {
      if (key === "batch")
        return async (statements: D1PreparedStatement[]) => {
          await env.DB.prepare("UPDATE teams SET archived_at=? WHERE id=?")
            .bind(new Date().toISOString(), ids.flow)
            .run();
          return env.DB.batch(statements);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(
    createOperatorIntake(wrapped, ids.sarah, input),
    /no longer available/,
  );
  assert.equal(
    await env.DB.prepare(
      "SELECT id FROM issues WHERE title='Race against archive'",
    ).first(),
    null,
  );
  await env.DB.prepare("UPDATE teams SET archived_at=NULL WHERE id=?")
    .bind(ids.flow)
    .run();
  const peer = await samplePeer(ownerCookie);
  await env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
    .bind(new Date().toISOString(), peer.id)
    .run();
  await assert.rejects(
    createOperatorIntake(
      env.DB,
      peer.id,
      operatorIntakeInputSchema.parse({
        title: "Removed actor report",
        teamId: ids.flow,
      }),
    ),
    /no longer available/,
  );
  assert.equal(
    await env.DB.prepare(
      "SELECT id FROM issues WHERE title='Removed actor report'",
    ).first(),
    null,
  );
  await env.DB.prepare("UPDATE operators SET removed_at=NULL WHERE id=?")
    .bind(peer.id)
    .run();
  await sampleSession(peer.cookie, 401);
  await sampleSession(ownerCookie);
});

it("[INTAKE-006 CURR-002] as-of reads do not end future deferrals or truncate a blocking dependency graph", async () => {
  await sampleSession(ownerCookie);
  const responseCreated = await request("/api/intake", {
    title: "Future deferred blocker",
    teamId: ids.flow,
  });
  assert.equal(responseCreated.status, 201);
  const created: any = await responseCreated.json();
  const future = new Date(Date.now() + 3600000).toISOString();
  assert.equal(
    (
      await request(`/api/issues/${created.identifier}/defer`, {
        expectedVersion: 1,
        returnAt: future,
      })
    ).status,
    200,
  );
  await env.DB.prepare(
    "INSERT INTO issue_dependencies(blocked_issue_id,blocking_issue_id,created_at) VALUES(?,?,?)",
  )
    .bind(ids.flw840, created.id, new Date().toISOString())
    .run();
  const response = await request(
    "/api/current?at=" +
      encodeURIComponent(new Date(Date.now() + 7200000).toISOString()),
  );
  assert.equal(response.status, 200);
  const current: any = await response.json();
  assert.ok(
    !current.sections["needs-decision"].some(
      (row: any) => row.identifier === created.identifier,
    ),
  );
  assert.ok(
    current.sections.now.some((row: any) => row.identifier === "FLW-840"),
  );
  const stored: any = await env.DB.prepare(
    "SELECT version,deferred_until FROM issues WHERE id=?",
  )
    .bind(created.id)
    .first();
  assert.equal(stored.version, 2);
  assert.equal(stored.deferred_until, future);
  assert.equal(
    await env.DB.prepare(
      "SELECT id FROM issue_activity WHERE issue_id=? AND kind='intake.returned'",
    )
      .bind(created.id)
      .first(),
    null,
  );
});
