import { expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { contractWith } from "../contract-tags";
import { collaborationFixture } from "./collaboration-fixture";
import { request, bindings, origin } from "./base-auth-fixture";
import { createServerApp } from "../../src/core/app/server";
import type { Workload } from "../../src/core/features/workload/schema";

contractWith(
  it,
  "REPORT-004",
  "cycle and due-date workload reconcile three assignees, unknown estimates and personal capacity without ranking output",
  async () => {
    const f = await collaborationFixture(),
      team = f.initial.teams[0]!;
    const local = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString().slice(0, 16);
    const state = await f.mutate("/settings/cycles", "POST", {
      teamId: team.id,
      name: "Delivery workload",
      startsLocal: local(-1),
      endsLocal: local(7),
    });
    const cycle = state.cycles.find((c) => c.name === "Delivery workload")!;
    const query = "?cycleId=" + cycle.id;
    const create = (
      assigneeOperatorId: string | null,
      estimate: number | null,
      extra = {},
    ) =>
      f.create({
        assigneeOperatorId,
        estimate,
        cycleId: cycle.id,
        dueDate: "2026-11-12",
        ...extra,
      });
    const [mine, bob, cara] = await Promise.all([
      create(f.owner, 8),
      create(f.bob, 5),
      create(f.cara, 3),
    ]);
    await create(f.owner, 5);
    await create(f.bob, null);
    await create(null, 2);
    await create(f.cara, 10, { dueDate: "2026-11-13" });
    const canceled = await create(f.cara, 20);
    expect(
      (
        await f.call("/issues/" + canceled.identifier, "PATCH", {
          expectedVersion: canceled.version,
          statusId: team.statuses.find((s) => s.category === "canceled")!.id,
        })
      ).status,
    ).toBe(200);
    for (const [cookie, capacity] of [
      [f.cookie, 10],
      [f.bobCookie, 5],
      [f.caraCookie, 13],
    ] as const) {
      const response = await f.any(cookie, "/workload" + query, "PUT", {
        capacity,
        expectedVersion: 0,
      });
      expect(response.status, await response.clone().text()).toBe(200);
    }
    const workload = (await f.data(f.cookie, "/workload" + query)) as Workload;
    const row = (id: string | null) =>
      workload.rows.find((r) => r.operatorId === id)!;
    expect(row(f.owner)).toMatchObject({
      points: 13,
      issueCount: 2,
      capacity: 10,
      state: "over-capacity",
    });
    expect(row(f.bob)).toMatchObject({
      points: 5,
      issueCount: 2,
      unestimated: 1,
      capacity: 5,
      state: "unknown",
    });
    expect(row(f.cara)).toMatchObject({
      points: 13,
      issueCount: 2,
      capacity: 13,
      state: "within-capacity",
    });
    expect(row(null)).toMatchObject({
      points: 2,
      issueCount: 1,
      state: "unknown",
    });
    expect(
      row(f.owner).issues.some((i) => i.identifier === mine.identifier),
    ).toBe(true);
    expect(row(f.bob).issues.some((i) => i.identifier === bob.identifier)).toBe(
      true,
    );
    expect(
      row(f.cara).issues.some((i) => i.identifier === cara.identifier),
    ).toBe(true);
    const dated = (await f.data(
      f.cookie,
      "/workload?from=2026-11-12&to=2026-11-12",
    )) as Workload;
    expect(dated.rows.find((r) => r.operatorId === f.cara)).toMatchObject({
      points: 3,
      issueCount: 1,
      capacity: null,
    });
    // The viewed period never borrows capacity from a different period.
    expect(
      dated.rows.find((r) => r.operatorId === f.owner)?.capacity,
    ).toBeNull();
    expect(
      (
        await f.any(f.cookie, "/workload" + query, "PUT", {
          capacity: 50,
          expectedVersion: 0,
        })
      ).status,
    ).toBe(409);
    expect(
      (await f.data(f.cookie, "/workload" + query)).rows.find(
        (r: { operatorId: string }) => r.operatorId === f.owner,
      ).capacity,
    ).toBe(10);
    expect(
      (
        await f.any(f.cookie, "/workload" + query, "PUT", {
          capacity: 0,
          expectedVersion: 1,
        })
      ).status,
    ).toBe(200);
    expect(
      (await f.data(f.cookie, "/workload" + query)).rows.find(
        (r: { operatorId: string }) => r.operatorId === f.owner,
      ),
    ).toMatchObject({ capacity: 0, state: "over-capacity" });
    expect(
      (
        await f.any(f.cookie, "/workload" + query, "PUT", {
          capacity: null,
          expectedVersion: 2,
        })
      ).status,
    ).toBe(200);
    expect(
      (await f.data(f.cookie, "/workload" + query)).rows.find(
        (r: { operatorId: string }) => r.operatorId === f.owner,
      ),
    ).toMatchObject({ capacity: null, state: "unknown" });
    const audit = await env.DB.prepare(
      "SELECT id FROM audit_records WHERE action='workload.capacity_changed' AND actor_operator_id=?",
    )
      .bind(f.owner)
      .all();
    expect(audit.results).toHaveLength(3);
  },
);
contractWith(
  it,
  "REPORT-004 BASE-ACCESS-002",
  "workload refuses invalid ranges, anonymous reads and writes and foreign cycles",
  async () => {
    const f = await collaborationFixture();
    for (const query of [
      "",
      "?from=2026-11-20&to=2026-11-01",
      "?from=2026-11-01",
      "?cycleId=bad",
    ])
      expect((await f.call("/workload" + query)).status).toBe(400);
    expect(
      (await f.call("/workload?cycleId=01J00000000000000000000999")).status,
    ).toBe(404);
    expect(
      (await request("/api/workload?from=2026-11-01&to=2026-11-30")).status,
    ).toBe(401);
    expect(
      (
        await f.any(
          f.cookie,
          "/workload?from=2026-11-01&to=2026-11-30",
          "PUT",
          { capacity: -1, expectedVersion: 0 },
        )
      ).status,
    ).toBe(400);
    const badOrigin = await createServerApp().request(
      origin + "/api/workload?from=2026-11-01&to=2026-11-30",
      {
        method: "PUT",
        headers: {
          cookie: f.cookie,
          origin: "https://another.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ capacity: 5, expectedVersion: 0 }),
      },
      bindings,
    );
    expect(badOrigin.status).toBe(403);
  },
);
