import { request as serverRequest } from "./base-auth-fixture";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, it, expect, inject } from "vitest";
import { Hono } from "hono";
import { createApiApp } from "../../src/core/app/api";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import {
  sampleOwner,
  sampleBindings,
  origin,
  sampleSession,
} from "./sample-auth-fixture";
import { listIssues } from "../../src/core/features/issues/list";
import {
  issueListQuerySchema,
  issueListSchema,
} from "../../src/core/features/issues/list-schema";
import { createUlid } from "../../src/core/shared/ids";
const app = new Hono().route("/api", createApiApp());
let cookie: string;
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00Z"));
  cookie = await sampleOwner();
  const created = await app.request(
    origin + "/api/issues",
    {
      method: "POST",
      headers: {
        host: new URL(origin).host,
        cookie,
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Synthetic ordinary backlog item",
        teamId: ids.flow,
      }),
    },
    sampleBindings,
  );
  expect(created.status).toBe(201);
});
const read = (query = "", session = cookie) =>
  app.request(
    origin + "/api/issues" + query,
    { headers: { host: new URL(origin).host, cookie: session } },
    sampleBindings,
  );
it("[VIEW-001 OPS-001] ordinary browsing requires a native session and validates filters", async () => {
  expect((await read("", "")).status).toBe(401);
  for (const query of [
    "?category=board",
    "?offset=-1",
    "?offset=1.5",
    "?assignee=not-an-id",
    "?q=" + "x".repeat(201),
    "?dueFrom=2026-02-30",
    "?dueFrom=2026-10-02&dueTo=2026-10-01",
    "?parent=bad",
    "?status=bad",
    "?grouping=bad",
    "?sort=bad",
  ])
    expect((await read(query)).status).toBe(400);
});
it("[VIEW-001 ISSUE-005] lists backlog independently of Current with exact status, assignee, search and empty states", async () => {
  const result = await read("?category=backlog");
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("no-store");
  const data = issueListSchema.parse(await result.json());
  expect(data.issues.length).toBeGreaterThan(0);
  expect(data.issues.every((row) => row.status.category === "backlog")).toBe(
    true,
  );
  const row = data.issues[0];
  const found = issueListSchema.parse(
    await (
      await read("?category=backlog&q=" + row.identifier.toLowerCase())
    ).json(),
  );
  expect(found.issues.map((item) => item.identifier)).toEqual([row.identifier]);
  const empty = issueListSchema.parse(
    await (await read("?q=NO-MATCH-SYNTHETIC-987654")).json(),
  );
  expect(empty.total).toBe(0);
  expect(empty.issues).toEqual([]);
  const normal = issueListSchema.parse(await (await read()).json());
  expect(
    normal.issues.every((item) => item.status.category !== "completed"),
  ).toBe(true);
  const unassigned = issueListSchema.parse(
    await (await read("?assignee=unassigned")).json(),
  );
  expect(unassigned.issues.every((item) => item.assignee === null)).toBe(true);
  const assignee = normal.assignees[0];
  const assigned = issueListSchema.parse(
    await (await read("?assignee=" + assignee.id)).json(),
  );
  expect(
    assigned.issues.every((item) => item.assignee?.id === assignee.id),
  ).toBe(true);
  const wildcards = issueListSchema.parse(
    await (await read("?q=" + encodeURIComponent("%_"))).json(),
  );
  expect(wildcards.total).toBe(0);
});
it("[VIEW-001] pages a bounded synthetic list without missing or repeating records", async () => {
  const template = await env.DB.prepare(
    "SELECT i.id FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE s.category='backlog' LIMIT 1",
  ).first<{ id: string }>();
  expect(template).not.toBeNull();
  await env.DB.batch(
    Array.from({ length: 51 }, (_, index) =>
      env.DB.prepare(
        `
    INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,description,status_id,priority,custom_fields_json,version,created_at,updated_at)
    SELECT ?,?,'PGD',?,team_id,?,'',status_id,'none','{}',1,created_at,updated_at FROM issues WHERE id=?
  `,
      ).bind(
        createUlid(new Date()),
        "PGD-" + (index + 1),
        index + 1,
        "Paged synthetic issue " + index,
        template!.id,
      ),
    ),
  );
  const first = issueListSchema.parse(
    await (await read("?q=Paged%20synthetic")).json(),
  );
  const second = issueListSchema.parse(
    await (
      await read(`?q=Paged%20synthetic&offset=50&revision=${first.revision}`)
    ).json(),
  );
  expect(first.total).toBe(51);
  expect(second.total).toBe(51);
  expect(first.issues).toHaveLength(50);
  expect(second.issues).toHaveLength(1);
  expect(
    new Set([...first.issues, ...second.issues].map((item) => item.id)).size,
  ).toBe(51);
});

it("[BASE-ACCESS-001 OPS-001] foreign issue, status, team and operator metadata never enters the list or count", async () => {
  const now = new Date().toISOString(),
    workspace = createUlid(new Date()),
    team = createUlid(new Date()),
    status = createUlid(new Date()),
    operator = createUlid(new Date());
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)").bind(
      workspace,
      "Foreign private workspace",
      "UTC",
      now,
      now,
    ),
    env.DB.prepare(
      "INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    ).bind(team, workspace, "Foreign private team", "FRN", now, now),
    env.DB.prepare("INSERT INTO workflow_statuses VALUES(?,?,?,?,?,?,?)").bind(
      status,
      team,
      "Foreign private status",
      "backlog",
      0,
      now,
      now,
    ),
    env.DB.prepare(
      "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    ).bind(
      operator,
      workspace,
      "Foreign private person",
      "foreign-list@example.test",
      now,
      now,
    ),
  ]);
  const target = await env.DB.prepare(
    "SELECT id,team_id,status_id,assignee_operator_id,title FROM issues LIMIT 1",
  ).first<any>();
  await env.DB.prepare(
    "UPDATE issues SET team_id=?,status_id=?,assignee_operator_id=?,title='Foreign private title' WHERE id=?",
  )
    .bind(team, status, operator, target!.id)
    .run();
  try {
    const installationBefore = (
      await env.DB.prepare("SELECT * FROM workspace_installation").all()
    ).results;
    expect(
      (
        await serverRequest(
          "/api/issues",
          "GET",
          undefined,
          cookie,
          sampleBindings,
        )
      ).status,
    ).toBe(503);
    expect(
      (await env.DB.prepare("SELECT * FROM workspace_installation").all())
        .results,
    ).toEqual(installationBefore);
    const response = await read("?q=Foreign private");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("Foreign private");
    const data = issueListSchema.parse(JSON.parse(text));
    expect(data.total).toBe(0);
    expect(data.assignees.some((item) => item.id === operator)).toBe(false);
  } finally {
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE issues SET team_id=?,status_id=?,assignee_operator_id=?,title=? WHERE id=?",
      ).bind(
        target.team_id,
        target.status_id,
        target.assignee_operator_id,
        target.title,
        target.id,
      ),
      env.DB.prepare("DELETE FROM workflow_statuses WHERE id=?").bind(status),
      env.DB.prepare("DELETE FROM team_issue_history WHERE team_id=?").bind(
        team,
      ),
      env.DB.prepare("DELETE FROM team_issue_sequences WHERE team_id=?").bind(
        team,
      ),
      env.DB.prepare("DELETE FROM teams WHERE id=?").bind(team),
      env.DB.prepare(
        "DELETE FROM vector_auth_operators WHERE operator_id=?",
      ).bind(operator),
      env.DB.prepare("DELETE FROM oa_operators WHERE id=?").bind(operator),
      env.DB.prepare("DELETE FROM operators WHERE id=?").bind(operator),
      env.DB.prepare(
        "DELETE FROM issue_prefix_sequences WHERE workspace_id=?",
      ).bind(workspace),
      env.DB.prepare("DELETE FROM workspace_settings WHERE id=?").bind(
        workspace,
      ),
    ]);
    await sampleSession(cookie);
  }
});
it("[BASE-ACCESS-001] removing the actor after projection refuses the entire late list", async () => {
  const wrapped = new Proxy(env.DB, {
    get(target, property) {
      if (property === "batch")
        return async (statements: D1PreparedStatement[]) => {
          const result = await target.batch(statements);
          await env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
            .bind(new Date().toISOString(), ids.sarah)
            .run();
          return result;
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  try {
    await expect(
      listIssues(wrapped, ids.sarah, issueListQuerySchema.parse({})),
    ).rejects.toMatchObject({ status: 401 });
  } finally {
    await env.DB.prepare("UPDATE operators SET removed_at=NULL WHERE id=?")
      .bind(ids.sarah)
      .run();
  }
});
