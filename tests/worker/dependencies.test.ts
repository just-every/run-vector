import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { Hono } from "hono";
import assert from "node:assert/strict";
import { beforeAll, inject, it } from "vitest";
import { createApiApp } from "../../src/core/app/api";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { createUlid } from "../../src/core/shared/ids";
import { testCookie } from "./native-fixture";

const origin = "https://vector.test",
  app = new Hono().route("/api", createApiApp());
let cookie: string;
type Issue = { id: string; identifier: string; version: number };
const timestamp = "2026-10-02T12:00:00.000Z";
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date(timestamp));
  cookie = await testCookie(env.DB, ids.sarah);
});

async function http(
  path: string,
  method = "GET",
  body?: unknown,
  db = env.DB,
  headers: Record<string, string> = {},
  raw?: string,
) {
  return app.request(
    origin + path,
    {
      method,
      headers: {
        cookie,
        origin,
        "content-type": "application/json",
        ...headers,
      },
      ...(body === undefined && raw === undefined
        ? {}
        : { body: raw ?? JSON.stringify(body) }),
    },
    { ...env, DB: db, APP_ORIGIN: origin, SEED_SAMPLE_DATA: "false" },
  );
}
async function fixture(teamId: string = ids.flow): Promise<Issue> {
  const response = await http("/api/issues", "POST", {
    title: "Native dependency endpoint",
    description: "Original **Markdown**",
    teamId,
    statusId: teamId === ids.flow ? ids.flowUnstarted : ids.platformUnstarted,
    assigneeOperatorId: ids.sarah,
    projectId: ids.reliability,
    cycleId: teamId === ids.flow ? ids.flowCycle : ids.platformCycle,
    priority: "high",
    estimate: 5,
    dueDate: "2026-10-01",
    expectedOutcome: "Retain outcome",
    customerImpact: "Retain impact",
    customFields: { nested: [3, null, { preserve: true }] },
    labelIds: [ids.reliabilityLabel],
  });
  assert.equal(response.status, 201);
  return response.json() as Promise<Issue>;
}
function input(
  a: Issue,
  b: Issue,
  direction: "blocks" | "blocked-by" = "blocks",
) {
  return {
    expectedVersion: a.version,
    relatedIdentifier: b.identifier,
    relatedVersion: b.version,
    direction,
  };
}
async function link(
  a: Issue,
  b: Issue,
  direction: "blocks" | "blocked-by" = "blocks",
  method = "POST",
  db = env.DB,
) {
  const response = await http(
    `/api/issues/${a.identifier}/dependencies`,
    method,
    input(a, b, direction),
    db,
  );
  if (response.status === 200) {
    const data: any = await response.clone().json();
    a.version = data.issue.version;
    b.version = data.relatedIssue.version;
  }
  return response;
}
async function receipt(issue: Issue) {
  return {
    issue: await env.DB.prepare("SELECT * FROM issues WHERE id=?")
      .bind(issue.id)
      .first<any>(),
    activity: (
      await env.DB.prepare(
        "SELECT * FROM issue_activity WHERE issue_id=? ORDER BY rowid",
      )
        .bind(issue.id)
        .all<any>()
    ).results,
    edges: (
      await env.DB.prepare(
        "SELECT * FROM issue_dependencies WHERE blocked_issue_id=? OR blocking_issue_id=? ORDER BY blocked_issue_id,blocking_issue_id",
      )
        .bind(issue.id, issue.id)
        .all<any>()
    ).results,
  };
}
async function before(a: Issue, b: Issue) {
  return [await receipt(a), await receipt(b)];
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
async function rawEdge(blocker: Issue, blocked: Issue) {
  await env.DB.prepare(
    "INSERT INTO issue_dependencies(blocked_issue_id,blocking_issue_id,created_at) VALUES(?,?,?)",
  )
    .bind(blocked.id, blocker.id, timestamp)
    .run();
}

it("[REL-001 ISSUE-006 ISSUE-007] native cross-team add/remove guards and increments both endpoints once, retaining all issue and prior graph facts", async () => {
  const a = await fixture(),
    b = await fixture(ids.platform);
  // Explicit isolated retained-data fixtures exercise existing bytes/graph
  // preservation, not newly implemented discussion/evidence authoring.
  const comment = createUlid(new Date()),
    file = createUlid(new Date()),
    key = "dependency-retained/" + file;
  await env.FILES.put(key, "Private original dependency bytes");
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    ).bind(comment, a.id, ids.maya, "Original comment", timestamp, timestamp),
    env.DB.prepare(
      "INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'ready',?,?)",
    ).bind(
      file,
      a.id,
      ids.sarah,
      "original.txt",
      "text/plain",
      new TextEncoder().encode("Private original dependency bytes").byteLength,
      key,
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      "INSERT INTO issue_links(id,issue_id,comment_id,actor_operator_id,name,url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
    ).bind(
      createUlid(new Date()),
      a.id,
      comment,
      ids.maya,
      "Prior link",
      "https://example.test/original",
      timestamp,
      timestamp,
    ),
  ]);
  const tables = [
    "issue_labels",
    "evidence_revisions",
    "intake_decisions",
    "issue_comments",
    "issue_links",
    "issue_files",
    "cycles",
    "team_issue_sequences",
  ];
  const graph = async () =>
    Promise.all(
      tables.map(async (table) => ({
        table,
        rows: (
          await env.DB.prepare(
            "SELECT * FROM " + table + " ORDER BY rowid",
          ).all()
        ).results,
      })),
    );
  const retained = await graph(),
    original = await before(a, b);
  const edgesBefore = (
    await env.DB.prepare(
      "SELECT * FROM issue_dependencies ORDER BY rowid",
    ).all()
  ).results;
  const unrelated = (
    await env.DB.prepare(
      "SELECT * FROM issues WHERE id NOT IN (?,?) ORDER BY id",
    )
      .bind(a.id, b.id)
      .all()
  ).results;
  try {
    const response = await link(a, b, "blocked-by");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const dto: any = await response.json();
    assert.deepEqual(dto.issue.dependencies.at(-1), {
      direction: "blocked-by",
      identifier: b.identifier,
      title: "Native dependency endpoint",
    });
    assert.deepEqual(dto.relatedIssue.dependencies.at(-1), {
      direction: "blocks",
      identifier: a.identifier,
      title: "Native dependency endpoint",
    });
    const after = await before(a, b);
    for (const [index, relation] of [
      [0, { relatedIdentifier: b.identifier, direction: "blocked-by" }],
      [1, { relatedIdentifier: a.identifier, direction: "blocks" }],
    ] as const) {
      assert.deepEqual(
        {
          ...after[index].issue,
          version: 1,
          updated_at: original[index].issue.updated_at,
        },
        original[index].issue,
      );
      assert.equal(after[index].issue.version, 2);
      assert.equal(
        after[index].activity.length,
        original[index].activity.length + 1,
      );
      assert.deepEqual(
        after[index].activity.slice(0, -1),
        original[index].activity,
      );
      const event = after[index].activity.at(-1);
      assert.equal(event.kind, "issue.dependency_added");
      assert.equal(event.actor_operator_id, ids.sarah);
      assert.equal(event.previous_value_json, null);
      assert.deepEqual(JSON.parse(event.next_value_json), relation);
    }
    // Remove through the other endpoint with the equivalent directed edge.
    assert.equal((await link(b, a, "blocks", "DELETE")).status, 200);
    const removed = await before(a, b);
    for (let index = 0; index < 2; index++) {
      assert.equal(removed[index].issue.version, 3);
      assert.deepEqual(
        {
          ...removed[index].issue,
          version: 1,
          updated_at: original[index].issue.updated_at,
        },
        original[index].issue,
      );
      const event = removed[index].activity.at(-1);
      assert.equal(event.kind, "issue.dependency_removed");
      assert.equal(event.actor_operator_id, ids.sarah);
      assert.equal(event.next_value_json, null);
      assert.equal(
        event.previous_value_json,
        after[index].activity.at(-1).next_value_json,
      );
      assert.deepEqual(
        removed[index].activity.slice(0, -1),
        after[index].activity,
      );
    }
    assert.deepEqual(
      (
        await env.DB.prepare(
          "SELECT * FROM issue_dependencies ORDER BY rowid",
        ).all()
      ).results,
      edgesBefore,
    );
    assert.deepEqual(await graph(), retained);
    assert.deepEqual(
      (
        await env.DB.prepare(
          "SELECT * FROM issues WHERE id NOT IN (?,?) ORDER BY id",
        )
          .bind(a.id, b.id)
          .all()
      ).results,
      unrelated,
    );
    assert.equal(
      await (await env.FILES.get(key))?.text(),
      "Private original dependency bytes",
    );
  } finally {
    await env.FILES.delete(key);
  }
});

it("[REL-001 BASE-ACCESS-001] native auth/origin and strict bounded canonical input reject without relationship effects", async () => {
  const a = await fixture(),
    b = await fixture(),
    original = await before(a, b),
    path = `/api/issues/${a.identifier}/dependencies`;
  for (const method of ["POST", "DELETE"]) {
    assert.equal(
      (await http(path, method, input(a, b), env.DB, { cookie: "" })).status,
      401,
    );
    assert.equal(
      (
        await http(path, method, input(a, b), env.DB, {
          origin: "https://hostile.test",
        })
      ).status,
      403,
    );
    for (const body of [
      { ...input(a, b), unexpected: true },
      { ...input(a, b), expectedVersion: 0 },
      { ...input(a, b), relatedVersion: 1.1 },
      { ...input(a, b), direction: "both" },
      { ...input(a, b), relatedIdentifier: "flw-01" },
      {
        expectedVersion: 1,
        relatedIdentifier: b.identifier,
        direction: "blocks",
      },
    ])
      assert.equal((await http(path, method, body)).status, 400);
    assert.equal(
      (await http(path, method, undefined, env.DB, {}, "{broken")).status,
      400,
    );
    assert.equal(
      (
        await http(path, method, input(a, b), env.DB, {
          "content-type": "text/plain",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await http(
          path,
          method,
          undefined,
          env.DB,
          {},
          JSON.stringify({ ...input(a, b), extra: "x".repeat(1048576) }),
        )
      ).status,
      413,
    );
  }
  assert.equal(
    (await http("/api/issues/FLW-01/dependencies", "POST", input(a, b))).status,
    400,
  );
  assert.deepEqual(await before(a, b), original);
});

it("[REL-001 ISSUE-006] both endpoint versions must match, and conflicts disclose related DTOs only when both endpoints remain authorized", async () => {
  const a = await fixture(),
    b = await fixture(),
    original = await before(a, b),
    path = `/api/issues/${a.identifier}/dependencies`;
  for (const field of ["expectedVersion", "relatedVersion"]) {
    const response = await http(path, "POST", { ...input(a, b), [field]: 2 });
    assert.equal(response.status, 409);
    const result: any = await response.json();
    assert.equal(result.error, "stale_version");
    assert.equal(result.issue.identifier, a.identifier);
    assert.equal(result.relatedIssue.identifier, b.identifier);
    assert.equal(result.version, 1);
    assert.equal(result.relatedVersion, 1);
  }
  const workspace = createUlid(new Date()),
    team = createUlid(new Date()),
    status = createUlid(new Date());
  // Foreign-workspace boundary is an explicit D1 fixture in this single-workspace product.
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workspace_settings VALUES(?,?,?,?,?)").bind(
      workspace,
      "Private fixture workspace",
      "UTC",
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      "INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    ).bind(
      team,
      workspace,
      "Foreign dependency team",
      "FRN",
      timestamp,
      timestamp,
    ),
    env.DB.prepare("INSERT INTO workflow_statuses VALUES(?,?,?,?,?,?,?)").bind(
      status,
      team,
      "Foreign Todo",
      "unstarted",
      0,
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      "UPDATE issues SET team_id=?,status_id=?,title='Private foreign title' WHERE id=?",
    ).bind(team, status, b.id),
  ]);
  const foreignBefore = await before(a, b);
  const authorizedRead = await http(`/api/issues/${a.identifier}`);
  assert.equal(authorizedRead.status, 200);
  assert.equal(((await authorizedRead.json()) as any).identifier, a.identifier);
  const foreignRead = await http(`/api/issues/${b.identifier}`);
  assert.equal(foreignRead.status, 404);
  const foreignText = await foreignRead.text();
  assert.ok(!foreignText.includes("Private foreign title"));
  assert.ok(!foreignText.includes(b.identifier));
  for (const [primary, related] of [
    [a, b],
    [b, a],
  ]) {
    const response = await http(
      `/api/issues/${primary.identifier}/dependencies`,
      "POST",
      { ...input(primary, related), expectedVersion: 99, relatedVersion: 99 },
    );
    assert.equal(response.status, 404);
    const text = await response.text();
    assert.ok(!text.includes("Private foreign title"));
    assert.ok(!text.includes("relatedIssue"));
  }
  assert.deepEqual(await before(a, b), foreignBefore);
  assert.deepEqual((await receipt(a)).activity, original[0].activity);
});

it("[REL-001 BASE-ACCESS-001] native related-issue lookup and stale conflict DTOs reauthorize after projection without leaking a removed actor's or foreign issue's data", async () => {
  const a = await fixture(),
    b = await fixture();
  for (const race of [
    "removed_actor",
    "issue_workspace",
    "stale_removed_actor",
  ] as const) {
    const workspace = createUlid(new Date());
    if (race === "issue_workspace")
      await env.DB.prepare("INSERT INTO workspace_settings VALUES(?,?,?,?,?)")
        .bind(
          workspace,
          "Foreign during projection",
          "UTC",
          timestamp,
          timestamp,
        )
        .run();
    let used = false;
    const wrap = (statement: D1PreparedStatement): D1PreparedStatement =>
      new Proxy(statement, {
        get(target, property) {
          if (property === "bind")
            return (...values: unknown[]) => wrap(target.bind(...values));
          if (property === "all")
            return async () => {
              const result = await target.all();
              if (!used) {
                used = true;
                if (race === "issue_workspace")
                  await env.DB.prepare(
                    "UPDATE teams SET workspace_id=? WHERE id=?",
                  )
                    .bind(workspace, ids.flow)
                    .run();
                else
                  await env.DB.prepare(
                    "UPDATE operators SET removed_at=? WHERE id=?",
                  )
                    .bind(timestamp, ids.sarah)
                    .run();
              }
              return result;
            };
          const value = Reflect.get(target, property);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    const db = new Proxy(env.DB, {
      get(target, property) {
        if (property === "prepare")
          return (query: string) => {
            const statement = target.prepare(query);
            return query.includes("SELECT id,actor_name FROM issue_activity")
              ? wrap(statement)
              : statement;
          };
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const original = await before(a, b);
    try {
      const response =
        race === "stale_removed_actor"
          ? await http(
              `/api/issues/${a.identifier}/dependencies`,
              "POST",
              { ...input(a, b), relatedVersion: 99 },
              db,
            )
          : await http(`/api/issues/${a.identifier}`, "GET", undefined, db);
      assert.ok(used, "race occurred after a real DTO projection read");
      assert.equal(response.status, race === "issue_workspace" ? 404 : 401);
      const body = await response.text();
      assert.ok(!body.includes("Native dependency endpoint"));
      assert.ok(!body.includes("Original **Markdown**"));
      assert.ok(!body.includes("relatedIssue"));
      assert.deepEqual(await before(a, b), original);
    } finally {
      await env.DB.batch([
        env.DB.prepare("UPDATE operators SET removed_at=NULL WHERE id=?").bind(
          ids.sarah,
        ),
        env.DB.prepare("UPDATE teams SET workspace_id=? WHERE id=?").bind(
          ids.workspace,
          ids.flow,
        ),
      ]);
    }
  }
});

it("[REL-001 REL-002] self, existing/reverse edges, longer directed cycles and missing directed removals are conflicts with no partial writes", async () => {
  const a = await fixture(),
    b = await fixture(),
    c = await fixture();
  const self = await link(a, a);
  assert.equal(self.status, 409);
  assert.equal(((await self.json()) as any).error, "self_dependency");
  assert.equal((await link(a, b)).status, 200);
  let original = await before(a, b);
  for (const [first, second] of [
    [a, b],
    [b, a],
  ]) {
    const response = await link(first, second);
    assert.equal(response.status, 409);
    assert.equal(((await response.json()) as any).error, "dependency_exists");
  }
  assert.deepEqual(await before(a, b), original);
  assert.equal((await link(a, b, "blocked-by", "DELETE")).status, 409);
  assert.deepEqual(await before(a, b), original);
  assert.equal((await link(b, c)).status, 200);
  original = await before(c, a);
  const cycle = await link(c, a);
  assert.equal(cycle.status, 409);
  assert.equal(((await cycle.json()) as any).error, "dependency_cycle");
  assert.deepEqual(await before(c, a), original);
  const absent = await link(c, a, "blocks", "DELETE");
  assert.equal(absent.status, 409);
  assert.equal(((await absent.json()) as any).error, "dependency_not_found");
  assert.deepEqual(await before(c, a), original);
});

it.each([
  "reverse",
  "cycle",
  "remove",
  "removed_actor",
  "actor_workspace",
  "issue_workspace",
  "primary_version",
  "related_version",
] as const)(
  "[REL-001 REL-002 ISSUE-006 BASE-ACCESS-001] %s is rechecked at the actual dependency batch boundary",
  async (race) => {
    const a = await fixture(),
      b = await fixture(),
      c = await fixture();
    if (race === "remove") assert.equal((await link(a, b)).status, 200);
    const original = await before(a, b);
    let raced: any;
    const db = beforeBatch(async () => {
      if (race === "reverse") await rawEdge(b, a);
      if (race === "cycle") {
        await rawEdge(b, c);
        await rawEdge(c, a);
      }
      if (race === "remove")
        await env.DB.prepare(
          "DELETE FROM issue_dependencies WHERE blocking_issue_id=? AND blocked_issue_id=?",
        )
          .bind(a.id, b.id)
          .run();
      if (race === "removed_actor")
        await env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
          .bind(timestamp, ids.sarah)
          .run();
      if (race === "actor_workspace" || race === "issue_workspace") {
        const workspace = createUlid(new Date());
        await env.DB.prepare("INSERT INTO workspace_settings VALUES(?,?,?,?,?)")
          .bind(
            workspace,
            "Concurrent foreign workspace",
            "UTC",
            timestamp,
            timestamp,
          )
          .run();
        if (race === "actor_workspace")
          await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
            .bind(workspace, ids.sarah)
            .run();
        else
          await env.DB.prepare("UPDATE teams SET workspace_id=? WHERE id=?")
            .bind(workspace, ids.flow)
            .run();
      }
      if (race === "primary_version" || race === "related_version")
        await env.DB.prepare(
          "UPDATE issues SET version=version+1,title='Concurrent edit' WHERE id=?",
        )
          .bind(race === "primary_version" ? a.id : b.id)
          .run();
      raced = await before(a, b);
    });
    try {
      const response = await link(
        a,
        b,
        "blocks",
        race === "remove" ? "DELETE" : "POST",
        db,
      );
      assert.equal(
        response.status,
        race === "removed_actor"
          ? 401
          : race === "actor_workspace" || race === "issue_workspace"
            ? 404
            : 409,
        race,
      );
      const body: any = await response.json();
      if (race === "primary_version" || race === "related_version") {
        assert.equal(body.error, "stale_version");
        assert.equal(body.version, race === "primary_version" ? 2 : 1);
        assert.equal(body.relatedVersion, race === "related_version" ? 2 : 1);
      } else if (race === "cycle") assert.equal(body.error, "dependency_cycle");
      else if (race === "reverse")
        assert.equal(body.error, "dependency_exists");
      else if (race === "remove")
        assert.equal(body.error, "dependency_not_found");
      else {
        assert.equal(body.issue, undefined);
        assert.equal(body.relatedIssue, undefined);
      }
      assert.deepEqual(await before(a, b), raced, race);
      assert.deepEqual((await receipt(a)).activity, original[0].activity);
      assert.deepEqual((await receipt(b)).activity, original[1].activity);
    } finally {
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE operators SET removed_at=NULL,workspace_id=? WHERE id=?",
        ).bind(ids.workspace, ids.sarah),
        env.DB.prepare("UPDATE teams SET workspace_id=? WHERE id=?").bind(
          ids.workspace,
          ids.flow,
        ),
      ]);
    }
  },
);

it("[REL-002] concurrent reverse edges and disjoint endpoint writes cannot complete a directed cycle after both validations", async () => {
  const a = await fixture(),
    b = await fixture(),
    c = await fixture(),
    d = await fixture();
  await rawEdge(b, c);
  await rawEdge(d, a);
  let entered = 0,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const db = new Proxy(env.DB, {
    get(target, property) {
      if (property === "batch")
        return async (writes: D1PreparedStatement[]) => {
          entered++;
          if (entered === 2) release();
          await gate;
          return target.batch(writes);
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const responses = await Promise.all([
    link(a, b, "blocks", "POST", db),
    link(c, d, "blocks", "POST", db),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    ((await responses.find((r) => r.status === 409)!.json()) as any).error,
    "dependency_cycle",
  );
  const receipts = await Promise.all([a, b, c, d].map(receipt));
  assert.deepEqual(receipts.map((r) => r.issue.version).sort(), [1, 1, 2, 2]);
  assert.equal(
    receipts
      .flatMap((r) => r.activity)
      .filter((r) => r.kind === "issue.dependency_added").length,
    2,
  );
  const x = await fixture(),
    y = await fixture();
  const reverse = await Promise.all([link(x, y), link(y, x)]);
  assert.deepEqual(reverse.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await receipt(x)).edges.length, 1);
  assert.equal((await receipt(y)).edges.length, 1);
});

it("[REL-001 REL-002 BASE-DATA-002] real D1 failure after edge/history writes rolls back both endpoints; failed remove never confirms success", async () => {
  const a = await fixture(),
    b = await fixture();
  const original = await before(a, b);
  await env.DB.exec(
    `CREATE TRIGGER dependency_failure BEFORE UPDATE OF version ON issues WHEN OLD.id='${b.id}' BEGIN SELECT RAISE(ABORT,'synthetic dependency D1 failure'); END;`,
  );
  try {
    const response = await link(a, b);
    assert.equal(response.status, 500);
    assert.equal(((await response.json()) as any).error, "internal_error");
    assert.deepEqual(await before(a, b), original);
  } finally {
    await env.DB.exec("DROP TRIGGER dependency_failure;");
  }
  assert.equal((await link(a, b)).status, 200);
  const linked = await before(a, b);
  await env.DB.exec(
    "CREATE TRIGGER dependency_remove_failure BEFORE DELETE ON issue_dependencies BEGIN SELECT RAISE(ABORT,'synthetic dependency remove D1 failure'); END;",
  );
  try {
    assert.equal((await link(a, b, "blocks", "DELETE")).status, 500);
    assert.deepEqual(await before(a, b), linked);
  } finally {
    await env.DB.exec("DROP TRIGGER dependency_remove_failure;");
  }
  assert.equal((await link(a, b, "blocks", "DELETE")).status, 200);
  assert.equal(a.version, 3);
  assert.equal(b.version, 3);
});

it("[REL-001 REL-002 WORK-001 WORK-002 CURR-006] Waiting follows live blockers/removal while dependency writes never change terminal or blocked workflow status", async () => {
  const blocker = await fixture(),
    blocked = await fixture();
  assert.equal((await link(blocker, blocked)).status, 200);
  const waiting = await http("/api/my-work");
  assert.ok(
    ((await waiting.json()) as any).sections.waiting.some(
      (i: any) => i.identifier === blocked.identifier,
    ),
  );
  const current = await http("/api/current");
  assert.ok(
    Object.values(((await current.json()) as any).sections)
      .flat()
      .some(
        (i: any) =>
          i.identifier === blocked.identifier &&
          i.contextReasons.includes("unresolved-dependency"),
      ),
  );
  for (const statusId of [
    ids.flowCompleted,
    ids.flowCanceled,
    ids.flowUnstarted,
  ]) {
    const response = await http(`/api/issues/${blocker.identifier}`, "PATCH", {
      expectedVersion: blocker.version,
      statusId,
    });
    assert.equal(response.status, 200);
    blocker.version = ((await response.json()) as any).version;
    const work: any = await (await http("/api/my-work")).json();
    assert.equal(
      work.sections.waiting.some(
        (i: any) => i.identifier === blocked.identifier,
      ),
      statusId === ids.flowUnstarted,
    );
    assert.equal((await receipt(blocked)).issue.status_id, ids.flowUnstarted);
  }
  // Duplicate authoring remains outside this slice. An explicit prior-data
  // fixture verifies that its terminal category also resolves a live blocker.
  await env.DB.prepare("UPDATE issues SET status_id=? WHERE id=?")
    .bind(ids.flowDuplicate, blocker.id)
    .run();
  assert.equal(
    ((await (await http("/api/my-work")).json()) as any).sections.waiting.some(
      (i: any) => i.identifier === blocked.identifier,
    ),
    false,
  );
  assert.equal((await receipt(blocked)).issue.status_id, ids.flowUnstarted);
  assert.equal((await link(blocker, blocked, "blocks", "DELETE")).status, 200);
  assert.equal(
    ((await (await http("/api/my-work")).json()) as any).sections.waiting.some(
      (i: any) => i.identifier === blocked.identifier,
    ),
    false,
  );
  const terminal = await fixture();
  const finished = await http(`/api/issues/${terminal.identifier}`, "PATCH", {
    expectedVersion: terminal.version,
    statusId: ids.flowCompleted,
  });
  assert.equal(finished.status, 200);
  terminal.version = ((await finished.json()) as any).version;
  const old = await receipt(terminal);
  assert.equal((await link(blocker, terminal)).status, 200);
  const newer = await receipt(terminal);
  assert.equal(newer.issue.status_id, ids.flowCompleted);
  assert.equal(newer.issue.completed_at, old.issue.completed_at);
  assert.equal(
    ((await (await http("/api/my-work")).json()) as any).sections.waiting.some(
      (i: any) => i.identifier === terminal.identifier,
    ),
    false,
  );
});
