import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { createIssueInputSchema } from "../../src/core/features/issues/input";
import { createIssueRecord } from "../../src/core/features/issues/repository";
import { loadWorkspaceSnapshot } from "../../src/core/features/streams/repository";
import type { WorkspaceSnapshot } from "../../src/core/features/streams/snapshot";
import { testCookie } from "./native-fixture";

const origin = "https://vector.test";
const app = createServerApp();
const config = {
  FIRST_OWNER_EMAIL: "calendar@vector.test",
  FIRST_OWNER_NAME: "Calendar operator",
  WORKSPACE_NAME: "Calendar workspace",
  WORKSPACE_TIMEZONE: "America/New_York",
  DEFAULT_TEAM_NAME: "Calendar team",
  DEFAULT_TEAM_PREFIX: "CAL",
};
const bindings = {
  ...env,
  ...config,
  APP_ORIGIN: origin,
  SEED_SAMPLE_DATA: "false",
};
let snapshot: WorkspaceSnapshot, cookie: string;
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await bootstrapWorkspace(env.DB, config);
  const initial = await loadWorkspaceSnapshot(env.DB);
  const owner = initial.operators[0]!;
  const team = initial.teams[0]!;
  const completed = initial.statuses.find(
    (status) => status.category === "completed",
  )!;
  await createIssueRecord(env.DB, {
    actorOperatorId: owner.id,
    now: new Date("2026-10-30T04:45:00.000Z"),
    input: createIssueInputSchema.parse({
      title: "Workspace calendar boundary",
      teamId: team.id,
      statusId: completed.id,
      assigneeOperatorId: owner.id,
    }),
  });
  snapshot = await loadWorkspaceSnapshot(env.DB);
  cookie = await testCookie(env.DB, owner.id);
});

it("[OPS-003 CURR-005] native settings round-trip changes Current membership without rewriting stored instants or history", async () => {
  const request = (path: string, timezone?: string) =>
    app.request(
      origin + "/api" + path,
      {
        method: timezone ? "PATCH" : "GET",
        headers: { cookie, origin, "content-type": "application/json" },
        body: timezone ? JSON.stringify({ timezone }) : undefined,
      },
      bindings,
    );
  const retained = async () =>
    Promise.all(
      ["issues", "issue_activity", "cycles", "operators"].map(
        async (table) =>
          (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all())
            .results,
      ),
    );
  await env.DB.prepare(
    "INSERT INTO cycles(id,team_id,name,starts_at,ends_at,closed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
  )
    .bind(
      "01K00000000000000000000001",
      snapshot.teams[0]!.id,
      "Retained cycle instants",
      "2026-10-23T04:00:00.000Z",
      "2026-10-30T04:00:00.000Z",
      "2026-10-30T04:01:00.000Z",
      "2026-10-01T04:00:00.000Z",
      "2026-10-30T04:01:00.000Z",
    )
    .run();
  const before = await retained();
  for (const [timezone, expected] of [
    ["America/New_York", ["CAL-1"]],
    ["America/Los_Angeles", []],
    ["America/New_York", ["CAL-1"]],
  ] as const) {
    const updated = await request("/settings", timezone);
    expect(updated.status).toBe(200);
    expect(
      ((await updated.json()) as { workspace: { timezone: string } }).workspace
        .timezone,
    ).toBe(timezone);
    const settings = await request("/settings");
    expect(
      ((await settings.json()) as { workspace: { timezone: string } }).workspace
        .timezone,
    ).toBe(timezone);
    // Both read dates are Nov 6, but the completion is Oct 30 in New York
    // and Oct 29 in Los Angeles. Only the workspace calendar changes.
    const at = "2026-11-06T08:30:00.000Z";
    const current = await request("/current?at=" + at);
    expect(current.status).toBe(200);
    const body = (await current.json()) as {
      sections: Record<string, Array<{ identifier: string }>>;
    };
    expect(
      body.sections["recently-done"]!.map((issue) => issue.identifier),
    ).toEqual(expected);
    expect(await retained()).toEqual(before);
  }
});
