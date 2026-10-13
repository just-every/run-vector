import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { createServerApp } from "../../src/core/app/server";
import { testCookie } from "./native-fixture";
import { createUlid } from "../../src/core/shared/ids";
import { removeOperator } from "../../src/core/features/settings/removal";

const config = {
  FIRST_OWNER_EMAIL: "owner@foundation.test",
  FIRST_OWNER_NAME: "Workspace owner",
  WORKSPACE_NAME: "Foundation workspace",
  WORKSPACE_TIMEZONE: "Australia/Brisbane",
  DEFAULT_TEAM_NAME: "Engineering",
  DEFAULT_TEAM_PREFIX: "ENG",
};
const origin = "https://127.0.0.1:15920",
  app = createServerApp();
const bindings = {
  ...env,
  ...config,
  APP_ORIGIN: origin,
  SEED_SAMPLE_DATA: "false",
  MAIL_MODE: "local-outbox",
};
const at = "2026-10-06T00:00:00.000Z";
let workspace: string, owner: string, team: string, cookie: string;
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await bootstrapWorkspace(env.DB, config, new Date(at));
  workspace = (await env.DB.prepare("SELECT id FROM workspace_settings").first<{
    id: string;
  }>())!.id;
  owner = (await env.DB.prepare("SELECT id FROM operators").first<{
    id: string;
  }>())!.id;
  team = (await env.DB.prepare("SELECT id FROM teams").first<{ id: string }>())!
    .id;
  cookie = await testCookie(env.DB, owner);
});
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  session = cookie,
  requestOrigin = origin,
) {
  return app.request(
    origin + "/api" + path,
    {
      method,
      headers: {
        cookie: session,
        host: new URL(origin).host,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    bindings,
  );
}
async function operator(name: string, createdAt = at) {
  const id = createUlid(new Date());
  await env.DB.prepare(
    "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  )
    .bind(id, workspace, name, id + "@foundation.test", createdAt, createdAt)
    .run();
  return id;
}
it("[TEAM-002 OPS-002] bootstraps exactly one owner, team and seven ordered categories without sample records; concurrent reruns preserve data", async () => {
  const before = await env.DB.prepare("SELECT * FROM workspace_settings").all();
  await Promise.all([
    bootstrapWorkspace(env.DB, config),
    bootstrapWorkspace(env.DB, {
      ...config,
      WORKSPACE_NAME: "Must not overwrite",
    }),
  ]);
  expect(
    (await env.DB.prepare("SELECT * FROM workspace_settings").all()).results,
  ).toEqual(before.results);
  expect(
    (await env.DB.prepare("SELECT count(*) AS n FROM operators").first())?.n,
  ).toBe(1);
  expect(
    (await env.DB.prepare("SELECT count(*) AS n FROM teams").first())?.n,
  ).toBe(1);
  expect(
    (
      await env.DB.prepare(
        "SELECT category FROM workflow_statuses ORDER BY position",
      ).all()
    ).results.map((r) => r.category),
  ).toEqual([
    "intake",
    "backlog",
    "unstarted",
    "started",
    "completed",
    "canceled",
    "duplicate",
  ]);
  for (const table of [
    "issues",
    "projects",
    "cycles",
    "labels",
    "evidence_revisions",
    "rer_mail_development_outbox",
  ])
    expect(
      (await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first())?.n,
    ).toBe(0);
  const issue = await request("/issues", "POST", {
    title: "Real first issue",
    teamId: team,
  });
  expect(issue.status).toBe(201);
  expect(((await issue.json()) as any).identifier).toBe("ENG-1");
});
it("[OPS-003 NOTIFY-005 BASE-ACCESS-002] settings require session and origin; timezone validation preserves stored instants", async () => {
  expect((await request("/settings", "GET", undefined, "")).status).toBe(401);
  expect(
    (
      await request(
        "/settings",
        "PATCH",
        { timezone: "Europe/London" },
        cookie,
        "https://foreign.test",
      )
    ).status,
  ).toBe(403);
  for (const timezone of ["Bad/Zone", "+03:00", ""])
    expect((await request("/settings", "PATCH", { timezone })).status).toBe(
      400,
    );
  for (const reminderTime of ["9:00", "24:00", "12:60", "09:00:00", ""])
    expect(
      (await request("/settings", "PATCH", { timezone: "UTC", reminderTime }))
        .status,
    ).toBe(400);
  const before = await env.DB.prepare(
    "SELECT * FROM operators ORDER BY id",
  ).all();
  const updated = await request("/settings", "PATCH", {
    timezone: "Europe/London",
    reminderTime: "14:35",
  });
  expect(updated.status).toBe(200);
  expect(((await updated.json()) as any).workspace).toMatchObject({
    timezone: "Europe/London",
    reminderTime: "14:35",
  });
  expect(
    (await env.DB.prepare("SELECT * FROM operators ORDER BY id").all()).results,
  ).toEqual(before.results);
  expect(
    ((await (await request("/settings")).json()) as any).workspace.timezone,
  ).toBe("Europe/London");
  expect(
    ((await (await request("/settings")).json()) as any).workspace.reminderTime,
  ).toBe("14:35");
});
it("[OPS-002 OPS-004] protects setup owner and last operator without revoking their sessions", async () => {
  const last = await request("/settings/operators/" + owner, "DELETE");
  expect(last.status).toBe(409);
  expect(((await last.json()) as any).error).toBe("last_operator");
  const second = await operator("Second"),
    secondCookie = await testCookie(env.DB, second);
  const protectedResult = await request(
    "/settings/operators/" + owner,
    "DELETE",
    undefined,
    secondCookie,
  );
  expect(protectedResult.status).toBe(409);
  expect(((await protectedResult.json()) as any).error).toBe(
    "setup_owner_protected",
  );
  expect((await request("/session")).status).toBe(200);
});
it("[OPS-004] removal revokes sessions and links, unassigns active work once and retains anonymised history and terminal work", async () => {
  const target = await operator("Removed member"),
    targetCookie = await testCookie(env.DB, target);
  const created = await request("/issues", "POST", {
    title: "Assigned task",
    teamId: team,
    assigneeOperatorId: target,
  });
  const issue = (await created.json()) as any;
  expect(created.status).toBe(201);
  const comments = await request(
    `/issues/${issue.identifier}/comments`,
    "POST",
    { body: "Preserved discussion" },
    targetCookie,
  );
  expect(comments.status).toBe(201);
  await env.DB.prepare(
    `INSERT INTO audit_records VALUES(?,?,'issue.changed',?,?,?,?)`,
  )
    .bind(createUlid(new Date()), target, issue.identifier, issue.id, at, at)
    .run();
  const terminalCreated = await request("/issues", "POST", {
    title: "Completed task",
    teamId: team,
    assigneeOperatorId: target,
  });
  const terminal = (await terminalCreated.json()) as any;
  const completed = (await env.DB.prepare(
    "SELECT id FROM workflow_statuses WHERE team_id=? AND category='completed'",
  )
    .bind(team)
    .first<{ id: string }>())!.id;
  expect(
    (
      await request("/issues/" + terminal.identifier, "PATCH", {
        expectedVersion: 1,
        statusId: completed,
      })
    ).status,
  ).toBe(200);
  const terminalBefore = await env.DB.prepare("SELECT * FROM issues WHERE id=?")
    .bind(terminal.id)
    .first();
  const sent = await app.request(
    origin + "/auth/request",
    {
      method: "POST",
      headers: {
        origin,
        host: new URL(origin).host,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: target + "@foundation.test" }),
    },
    bindings,
  );
  expect(sent.status).toBe(202);
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM oa_tokens WHERE operator_id=? AND revoked_at IS NULL AND consumed_at IS NULL",
      )
        .bind(target)
        .first()
    )?.n,
  ).toBe(1);
  const result = await request("/settings/operators/" + target, "DELETE");
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM oa_tokens WHERE operator_id=? AND revoked_at IS NOT NULL",
    )
      .bind(target)
      .first("n"),
  ).toBe(1);
  expect(result.status).toBe(200);
  expect(
    await env.DB.prepare("SELECT * FROM issues WHERE id=?")
      .bind(terminal.id)
      .first(),
  ).toEqual(terminalBefore);
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM oa_tokens WHERE operator_id=? AND revoked_at IS NULL AND consumed_at IS NULL",
      )
        .bind(target)
        .first()
    )?.n,
  ).toBe(0);
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')=?",
      )
        .bind(target + "@foundation.test")
        .first()
    )?.n,
  ).toBe(0);
  expect(
    (await request("/session", "GET", undefined, targetCookie)).status,
  ).toBe(401);
  const stored = await env.DB.prepare(
    "SELECT assignee_operator_id,version FROM issues WHERE id=?",
  )
    .bind(issue.id)
    .first();
  expect(stored).toEqual({ assignee_operator_id: null, version: 2 });
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM issue_activity WHERE issue_id=? AND kind='issue.operator_removed'",
      )
        .bind(issue.id)
        .first()
    )?.n,
  ).toBe(1);
  expect(
    (
      await env.DB.prepare("SELECT body FROM issue_comments WHERE issue_id=?")
        .bind(issue.id)
        .first()
    )?.body,
  ).toBe("Preserved discussion");
  expect(
    await env.DB.prepare("SELECT name,email FROM operators WHERE id=?")
      .bind(target)
      .first(),
  ).toEqual({ name: "Removed operator", email: target + "@removed.invalid" });
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM audit_records WHERE actor_operator_id=?",
      )
        .bind(target)
        .first()
    )?.n,
  ).toBe(0);
  expect(
    (await request("/settings/operators/" + target, "DELETE")).status,
  ).toBe(404);
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM issue_activity WHERE issue_id=? AND kind='issue.operator_removed'",
      )
        .bind(issue.id)
        .first()
    )?.n,
  ).toBe(1);
});
it("[OPS-004] self-removal transfers projects and shared views to the longest-standing remaining operator; private views disappear", async () => {
  const oldest = await operator("Oldest", "2026-10-01T00:00:00.000Z");
  await operator("Newest", "2026-10-05T00:00:00.000Z");
  const project = createUlid(new Date());
  await env.DB.prepare(
    "INSERT INTO projects(id,workspace_id,name,lead_operator_id,lifecycle,created_at,updated_at) VALUES(?,?,?,?,'active',?,?)",
  )
    .bind(project, workspace, "Owner project", owner, at, at)
    .run();
  for (const [who, name, shared] of [
    [owner, "Work", 1],
    [owner, "Private", 0],
    [oldest, "Work", 1],
    [oldest, "Work (transferred)", 1],
  ] as const)
    await env.DB.prepare(
      "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,is_shared,created_at,updated_at) VALUES(?,?,?,?,'issues',?,?,?)",
    )
      .bind(createUlid(new Date()), workspace, who, name, shared, at, at)
      .run();
  const result = await request("/settings/operators/" + owner, "DELETE");
  expect(result.status).toBe(200);
  expect(result.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(
    (
      await env.DB.prepare("SELECT lead_operator_id FROM projects WHERE id=?")
        .bind(project)
        .first()
    )?.lead_operator_id,
  ).toBe(oldest);
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS n FROM project_activity WHERE project_id=?",
      )
        .bind(project)
        .first()
    )?.n,
  ).toBe(1);
  const views = (
    await env.DB.prepare(
      "SELECT name,owner_operator_id FROM saved_views ORDER BY name",
    ).all()
  ).results;
  expect(views).toHaveLength(3);
  expect(views.every((row) => row.owner_operator_id === oldest)).toBe(true);
  expect(views.map((row) => row.name)).toContain(
    "Work (transferred) (transferred)",
  );
});
