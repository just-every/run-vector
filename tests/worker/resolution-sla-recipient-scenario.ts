import { env } from "cloudflare:workers";
import { expect, vi } from "vitest";
import { request } from "./base-auth-fixture";
import type { setupAdministration } from "./administration-fixture";

/** Both selected filters gate the clock. Current recipients are deduplicated,
 * and an actor who is both assignee and responsible still receives nothing. */
export async function resolutionSlaRecipientJourney(
  f: Awaited<ReturnType<typeof setupAdministration>> & {
    bob: string;
    bobCookie: string;
    cara: string;
    caraCookie: string;
  },
  tick: (at: string) => Promise<void>,
) {
  vi.setSystemTime(new Date("2026-11-03T11:00:00Z"));
  expect((await f.call("/settings", "PATCH", { timezone: "UTC" })).status).toBe(
    200,
  );
  const team = (
    await f.mutate("/settings/teams", "POST", {
      name: "synthetic-vector-198",
      identifierPrefix: "SLARECIP",
    })
  ).teams.find((row) => row.identifierPrefix === "SLARECIP")!;
  const response = await f.call("/settings/labels", "POST", {
    name: "synthetic-vector-198",
    color: "#4f46e5",
  });
  expect(response.status).toBe(200);
  const label = (
    (await response.json()) as { labels: { id: string; name: string }[] }
  ).labels.find((row) => row.name === "synthetic-vector-198")!;
  expect(
    (
      await f.call(`/settings/teams/${team.id}/sla`, "PUT", {
        enabled: true,
        priority: "urgent",
        labelId: label.id,
        targetMinutes: 10,
        warnBeforeMinutes: 5,
        workingDays: [1, 2, 3, 4, 5],
        startsAt: "09:00",
        endsAt: "17:00",
      })
    ).status,
  ).toBe(200);
  for (const member of [f.bob, f.cara])
    expect(
      (
        await f.call(`/settings/teams/${team.id}/members/${member}`, "PUT", {
          role: "member",
        })
      ).status,
    ).toBe(200);
  const rotation = async (operator: string) => {
    expect(
      (
        await f.call(`/settings/teams/${team.id}/triage-rotation`, "PUT", {
          startsLocal: "2026-11-03T11:00",
          operatorIds: [operator, f.bob],
        })
      ).status,
    ).toBe(200);
  };
  const warnings = async (cookie: string, identifier: string) => {
    const response = await request(
      "/api/notifications?limit=50",
      "GET",
      undefined,
      cookie,
    );
    expect(response.status).toBe(200);
    return (
      (await response.json()) as {
        items: { identifier: string; causes: string[] }[];
      }
    ).items.filter(
      (row) =>
        row.identifier === identifier && row.causes.includes("sla_warning"),
    );
  };
  const excluded = [
    await f.create({ teamId: team.id, priority: "low", labelIds: [label.id] }),
    await f.create({ teamId: team.id, priority: "urgent" }),
  ];
  const self = await f.create({
    teamId: team.id,
    priority: "urgent",
    labelIds: [label.id],
    assigneeOperatorId: f.owner,
  });
  await rotation(f.owner);
  await tick("2026-11-03T11:05:00Z");
  for (const issue of excluded) {
    expect(
      await (await f.call(`/issues/${issue.identifier}/sla`)).json(),
    ).toBeNull();
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM issue_sla_clocks WHERE issue_id=?",
      )
        .bind(issue.id)
        .first("n"),
    ).toBe(0);
  }
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM issue_sla_occurrences WHERE issue_id=? AND kind='warning'",
    )
      .bind(self.id)
      .first("n"),
  ).toBe(1);
  expect(await warnings(f.cookie, self.identifier)).toHaveLength(0);
  const reassigned = await f.create({
    teamId: team.id,
    priority: "urgent",
    labelIds: [label.id],
    assigneeOperatorId: f.bob,
  });
  vi.setSystemTime(new Date("2026-11-03T11:07:00Z"));
  expect(
    (
      await f.call(`/issues/${reassigned.identifier}`, "PATCH", {
        expectedVersion: reassigned.version,
        assigneeOperatorId: f.cara,
      })
    ).status,
  ).toBe(200);
  await rotation(f.cara);
  await Promise.all([
    tick("2026-11-03T11:10:00Z"),
    tick("2026-11-03T11:10:00Z"),
  ]);
  expect(await warnings(f.caraCookie, reassigned.identifier)).toHaveLength(1);
  expect(await warnings(f.bobCookie, reassigned.identifier)).toHaveLength(0);
  await tick("2026-11-03T11:11:00Z");
  expect(await warnings(f.caraCookie, reassigned.identifier)).toHaveLength(1);
  vi.setSystemTime(new Date("2026-11-02T16:26:00Z"));
  expect(
    (await f.call("/settings", "PATCH", { timezone: "America/New_York" }))
      .status,
  ).toBe(200);
}
