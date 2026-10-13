import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { createIssueInputSchema } from "../../src/core/features/issues/input";
import { createIssueRecord } from "../../src/core/features/issues/repository";
import { loadWorkspaceSnapshot } from "../../src/core/features/streams/repository";
import type { getCurrentStream } from "../../src/core/features/streams/service";
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

const windows = [
  {
    name: "New York fall-back",
    timezone: "America/New_York",
    now: "2026-11-06T05:30:00.000Z",
    start: "2026-10-30T04:00:00.000Z",
  },
  {
    name: "New York spring-forward",
    timezone: "America/New_York",
    now: "2026-03-13T04:30:00.000Z",
    start: "2026-03-06T05:00:00.000Z",
  },
  {
    name: "Lord Howe half-hour fall-back",
    timezone: "Australia/Lord_Howe",
    now: "2026-04-10T14:15:00.000Z",
    start: "2026-04-03T13:00:00.000Z",
  },
  {
    name: "Kathmandu quarter-hour offset and year boundary",
    timezone: "Asia/Kathmandu",
    now: "2027-01-03T00:30:00.000Z",
    start: "2026-12-26T18:15:00.000Z",
  },
  {
    name: "Brisbane without DST",
    timezone: "Australia/Brisbane",
    now: "2026-09-08T15:30:00.000Z",
    start: "2026-09-01T14:00:00.000Z",
  },
  {
    name: "UTC leap-day boundary",
    timezone: "UTC",
    now: "2028-03-07T12:00:00.000Z",
    start: "2028-02-29T00:00:00.000Z",
  },
];
async function readCalendar(candidate: WorkspaceSnapshot, at: Date) {
  await env.DB.prepare("DELETE FROM issues").run();
  await env.DB.prepare("UPDATE workspace_settings SET timezone=? WHERE id=?")
    .bind(candidate.workspace!.timezone, candidate.workspace!.id)
    .run();
  await env.DB.batch(
    candidate.issues.map((row, index) =>
      env.DB.prepare(
        "INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,assignee_operator_id,completed_at,deferred_until,due_date,created_at,updated_at) VALUES(?,?,'CAL',?,?,?,?,?,?,?,?,?,'2026-01-01','2026-01-01')",
      ).bind(
        row.id,
        row.identifier,
        index + 1,
        row.teamId,
        row.title,
        row.statusId,
        row.priority,
        row.assigneeOperatorId,
        row.completedAt,
        row.deferredUntil,
        row.dueDate,
      ),
    ),
  );
  const response = await app.request(
    origin + "/api/current?at=" + at.toISOString(),
    { headers: { cookie } },
    bindings,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as Awaited<
    ReturnType<typeof getCurrentStream>
  >;
}
async function calendarBoundaries() {
  for (const { timezone, now, start } of windows) {
    const candidate = structuredClone(snapshot);
    candidate.workspace!.timezone = timezone;
    const lower = Date.parse(start),
      upper = Date.parse(now);
    // These instants straddle explicit local-midnight boundaries, independent of
    // the product's date arithmetic, and distinguish calendar from elapsed days.
    for (const [instant, included] of [
      [lower - 1, false],
      [lower, true],
      [lower + 45 * 60_000, true],
      [upper - 60_000, true],
      [upper, true],
      [upper + 1, false],
      [upper + 86_400_000, false],
    ] as const) {
      candidate.issues[0]!.completedAt = new Date(instant).toISOString();
      const projected = await readCalendar(candidate, new Date(now));
      expect(
        projected.sections["recently-done"].map((row) => row.identifier),
        new Date(instant).toISOString(),
      ).toEqual(included ? ["CAL-1"] : []);
      expect(Object.values(projected.sections).flat()).toHaveLength(
        included ? 1 : 0,
      );
    }
    candidate.issues[0]!.completedAt = null;
    expect(
      (await readCalendar(candidate, new Date(now))).sections["recently-done"],
    ).toEqual([]);
  }
  {
    const candidate = structuredClone(snapshot);
    const row = candidate.issues[0]!;
    candidate.issues = [
      {
        ...row,
        id: "newer",
        identifier: "CAL-3",
        priority: "none",
        completedAt: "2026-11-05T23:00:00.000Z",
      },
      { ...row, id: "tie-b", identifier: "CAL-2", priority: "urgent" },
      { ...row, id: "tie-a", identifier: "CAL-1", priority: "high" },
      {
        ...row,
        id: "canceled",
        identifier: "CAL-4",
        statusId: candidate.statuses.find((s) => s.category === "canceled")!.id,
      },
      {
        ...row,
        id: "duplicate",
        identifier: "CAL-5",
        statusId: candidate.statuses.find((s) => s.category === "duplicate")!
          .id,
      },
      {
        ...row,
        id: "deferred",
        identifier: "CAL-6",
        deferredUntil: "2026-11-07T00:00:00.000Z",
      },
      {
        ...row,
        id: "started",
        identifier: "CAL-7",
        statusId: candidate.statuses.find((s) => s.category === "started")!.id,
        dueDate: "2026-11-05",
      },
    ];
    const current = await readCalendar(
      candidate,
      new Date("2026-11-06T05:30:00.000Z"),
    );
    const done = current.sections["recently-done"];
    expect(done.map((issue) => issue.identifier)).toEqual([
      "CAL-3",
      "CAL-1",
      "CAL-2",
    ]);
    expect(
      done.every(
        (issue) => issue.primaryReason === "completed-within-seven-days",
      ),
    ).toBe(true);
    expect(
      current.sections.now.map((issue) => [
        issue.identifier,
        issue.primaryReason,
      ]),
    ).toEqual([["CAL-7", "overdue"]]);
    expect(Object.values(current.sections).flat()).toHaveLength(4);
  }
  for (const { timezone, now } of windows.slice(0, 2)) {
    const candidate = structuredClone(snapshot);
    candidate.workspace!.timezone = timezone;
    const fall = timezone === "America/New_York" && now.startsWith("2026-11");
    const dates = fall
      ? ["2026-11-05", "2026-11-06", "2026-11-13", "2026-11-14"]
      : ["2026-03-12", "2026-03-13", "2026-03-20", "2026-03-21"];
    candidate.issues = dates.map((dueDate, index) => ({
      ...candidate.issues[0]!,
      id: String(index),
      identifier: `CAL-${index + 1}`,
      statusId: candidate.statuses.find((s) => s.category === "unstarted")!.id,
      completedAt: null,
      dueDate,
    }));
    const current = await readCalendar(candidate, new Date(now));
    expect(current.sections.now.map((issue) => issue.identifier)).toEqual([
      "CAL-1",
    ]);
    expect(current.sections.next.map((issue) => issue.identifier)).toEqual([
      "CAL-2",
      "CAL-3",
    ]);
    expect(current.sections["recently-done"]).toEqual([]);
  }
}

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
  await calendarBoundaries();
});
