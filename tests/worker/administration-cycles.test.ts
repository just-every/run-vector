import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { setupAdministration } from "./administration-fixture";
const check = (ids: string, name: string, run: () => Promise<void>) =>
  contractWith(it, ids, name, run);
check(
  "CYCLE-001 OPS-003",
  "manual cycles reject concurrent overlap and DST uncertainty while preserving stored instants",
  async () => {
    const f = await setupAdministration(),
      teamId = f.initial.teams[0].id;
    const input = {
      teamId,
      name: "First",
      startsLocal: "2026-10-10T09:00",
      endsLocal: "2026-10-20T09:00",
      capacity: 0,
    };
    const results = await Promise.all(
      [input, { ...input, name: "Collision" }].map((body) =>
        f.call("/settings/cycles", "POST", body),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const first = (await f.state()).cycles[0];
    for (const dates of [
      ["2026-10-09T09:00", "2026-10-21T09:00"],
      ["2026-10-11T09:00", "2026-10-12T09:00"],
    ])
      expect(
        (
          await f.call("/settings/cycles", "POST", {
            ...input,
            name: "Overlap",
            startsLocal: dates[0],
            endsLocal: dates[1],
          })
        ).status,
      ).toBe(409);
    expect(
      (
        await f.call("/settings/cycles", "POST", {
          ...input,
          name: "Touching",
          startsLocal: input.endsLocal,
          endsLocal: "2026-10-27T09:00",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await f.call("/settings/cycles", "POST", {
          ...input,
          name: "Invalid",
          capacity: -1,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call("/settings/cycles", "POST", {
          ...input,
          name: "Invalid",
          capacity: 1.5,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call("/settings/cycles", "POST", {
          ...input,
          name: "Invalid",
          endsLocal: input.startsLocal,
        })
      ).status,
    ).toBe(400);
    const other = (
      await f.mutate("/settings/teams", "POST", {
        name: "Other",
        identifierPrefix: "OTH",
      })
    ).teams.find((t) => t.name === "Other")!;
    expect(
      (await f.call("/settings/cycles", "POST", { ...input, teamId: other.id }))
        .status,
    ).toBe(200);
    expect(
      (await f.call("/settings", "PATCH", { timezone: "America/New_York" }))
        .status,
    ).toBe(200);
    for (const time of ["2026-03-08T02:30", "2026-11-01T01:30"])
      expect(
        (
          await f.call("/settings/cycles", "POST", {
            ...input,
            name: "DST",
            startsLocal: time,
            endsLocal: "2027-01-01T00:00",
          })
        ).status,
      ).toBe(400);
    const after = (await f.state()).cycles.find((c) => c.id === first.id)!;
    expect(after.startsAt).toBe(first.startsAt);
    expect(after.endsAt).toBe(first.endsAt);
  },
);
check(
  "CYCLE-002 ISSUE-006 ISSUE-007",
  "commit move uncommit updates both derived populations and exact history; terminal retention remains valid",
  async () => {
    const f = await setupAdministration(),
      team = (
        await f.mutate("/settings/teams", "POST", {
          name: "Commitments",
          identifierPrefix: "COM",
        })
      ).teams.find((t) => t.name === "Commitments")!;
    await f.mutate("/settings/cycles", "POST", {
      teamId: team.id,
      name: "First",
      startsLocal: "2026-10-10T00:00",
      endsLocal: "2026-10-20T00:00",
    });
    const cycles = (
      await f.mutate("/settings/cycles", "POST", {
        teamId: team.id,
        name: "Next",
        startsLocal: "2026-10-20T00:00",
        endsLocal: "2026-10-30T00:00",
      })
    ).cycles.filter((c) => c.teamId === team.id);
    const issue = await f.create({ teamId: team.id }),
      path = "/issues/" + issue.identifier;
    expect(
      (
        await f.call(path, "PATCH", {
          expectedVersion: 1,
          cycleId: cycles[0].id,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await f.call(path, "PATCH", {
          expectedVersion: 1,
          cycleId: cycles[1].id,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await f.call(path, "PATCH", {
          expectedVersion: 2,
          cycleId: cycles[1].id,
        })
      ).status,
    ).toBe(200);
    const detail = async (id: string) =>
      (await (await f.call("/cycles/" + id)).json()) as { issues: unknown[] };
    expect((await detail(cycles[0].id)).issues).toHaveLength(0);
    expect((await detail(cycles[1].id)).issues).toHaveLength(1);
    const move = await env.DB.prepare(
      "SELECT previous_value_json,next_value_json FROM issue_activity WHERE issue_id=? AND kind='issue.updated' ORDER BY rowid DESC LIMIT 1",
    )
      .bind(issue.id)
      .first<{ previous_value_json: string; next_value_json: string }>();
    expect(JSON.parse(move!.previous_value_json)).toEqual({
      cycleId: cycles[0].id,
    });
    expect(JSON.parse(move!.next_value_json)).toEqual({
      cycleId: cycles[1].id,
    });
    expect(
      (
        await f.call(path, "PATCH", {
          expectedVersion: 3,
          statusId: team.statuses.find((s) => s.category === "completed")!.id,
        })
      ).status,
    ).toBe(200);
    expect((await detail(cycles[1].id)).issues).toHaveLength(1);
    expect(
      (
        await f.call(path, "PATCH", {
          expectedVersion: 4,
          cycleId: cycles[0].id,
        })
      ).status,
    ).toBe(400);
    expect(
      (await f.call(path, "PATCH", { expectedVersion: 4, cycleId: null }))
        .status,
    ).toBe(200);
    expect((await detail(cycles[1].id)).issues).toHaveLength(0);
    expect(
      (
        await f.call("/issues", "POST", {
          title: "Terminal commit",
          teamId: team.id,
          statusId: team.statuses.find((s) => s.category === "completed")!.id,
          cycleId: cycles[0].id,
        })
      ).status,
    ).toBe(400);
  },
);
