import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import { fixture } from "./removal-fixture";
import { createUlid } from "../../src/core/shared/ids";
beforeAll(async () => applyD1Migrations(env.DB, inject("migrations")));
it("[OPS-004 ISSUE-007] removal changes only known operator references and preserves arbitrary JSON keys, values and native reads", async () => {
  const f = await fixture();
  const customFields = {
    allocations: { [f.member]: 3 },
    copiedId: f.member,
    assigneeOperatorId: f.member,
    nested: [null, true, { leadOperatorId: f.member }],
  };
  const created = await f.request("/issues", "POST", {
    title: "Arbitrary metadata",
    teamId: f.team,
    assigneeOperatorId: f.member,
    customFields,
  });
  expect(created.status).toBe(201);
  const issue = (await created.json()) as any;
  const old = (
    await env.DB.prepare("SELECT * FROM issue_activity WHERE issue_id=?")
      .bind(issue.id)
      .all()
  ).results;
  const shapes = [
    null,
    "null",
    JSON.stringify(f.member),
    JSON.stringify([f.member, { assigneeOperatorId: f.member }]),
    '{ "customFields" : {"assigneeOperatorId":"' + f.member + '"} }',
  ];
  const ids = [];
  for (const payload of shapes) {
    const id = createUlid(new Date());
    ids.push(id);
    await env.DB.prepare(
      "INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,'retained.extension',?,?,?,?)",
    )
      .bind(
        id,
        f.issue.id,
        f.owner,
        payload,
        payload,
        "2026-10-01",
        "2026-10-01",
      )
      .run();
  }
  const unrelated = (
    await env.DB.prepare(
      "SELECT * FROM issue_activity WHERE issue_id=? ORDER BY id",
    )
      .bind(f.issue.id)
      .all()
  ).results;
  expect((await f.remove()).status).toBe(200);
  const current = await f.request("/issues/" + issue.identifier);
  expect(current.status).toBe(200);
  expect(((await current.json()) as any).customFields).toEqual(customFields);
  expect((await f.request("/issues/" + f.issue.identifier)).status).toBe(200);
  for (const original of old) {
    const row = await env.DB.prepare("SELECT * FROM issue_activity WHERE id=?")
      .bind(original.id)
      .first();
    const expected = JSON.parse(original.next_value_json as string);
    expected.assigneeOperatorId = null;
    expect(row).toEqual({
      ...original,
      next_value_json: JSON.stringify(expected),
    });
  }
  expect(
    (
      await env.DB.prepare(
        "SELECT * FROM issue_activity WHERE issue_id=? ORDER BY id",
      )
        .bind(f.issue.id)
        .all()
    ).results,
  ).toEqual(unrelated);
  expect(
    (await env.DB.prepare(
      "SELECT count(*) AS n FROM issue_activity WHERE next_value_json IS NOT NULL AND NOT json_valid(next_value_json)",
    ).first())!.n,
  ).toBe(0);
});

it("[OPS-004] project transfer anonymizes only native lead references and retains payload data and timestamps", async () => {
  const f = await fixture(),
    project = createUlid(new Date()),
    activity = createUlid(new Date());
  const at = "2026-10-02T00:00:00.000Z";
  await env.DB.prepare(
    "INSERT INTO projects(id,workspace_id,name,lead_operator_id,lifecycle,created_at,updated_at) VALUES(?,?,?,?,'active',?,?)",
  )
    .bind(project, f.workspace, "Retained project", f.member, at, at)
    .run();
  const previous = {
      leadOperatorId: f.member,
      customFields: { [f.member]: f.member },
    },
    next = { leadOperatorId: f.owner, other: f.member };
  await env.DB.prepare(
    "INSERT INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,'project.updated',?,?,?,?)",
  )
    .bind(
      activity,
      project,
      f.member,
      JSON.stringify(previous),
      JSON.stringify(next),
      at,
      at,
    )
    .run();
  const before = (await env.DB.prepare(
    "SELECT * FROM project_activity WHERE id=?",
  )
    .bind(activity)
    .first())!;
  expect((await f.remove()).status).toBe(200);
  expect(
    await env.DB.prepare("SELECT * FROM project_activity WHERE id=?")
      .bind(activity)
      .first(),
  ).toEqual({
    ...before,
    actor_operator_id: null,
    previous_value_json: JSON.stringify({ ...previous, leadOperatorId: null }),
  });
  expect(
    (await env.DB.prepare("SELECT lead_operator_id FROM projects WHERE id=?")
      .bind(project)
      .first())!.lead_operator_id,
  ).toBe(f.owner);
  expect((await f.request("/projects/" + project)).status).toBe(200);
}, 20000);
