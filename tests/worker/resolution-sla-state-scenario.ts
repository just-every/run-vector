import { env } from "cloudflare:workers";
import { expect, vi } from "vitest";
import type { setupAdministration } from "./administration-fixture";

/** Exercise clock custody through the same native configuration and issue doors
 * as the main SLA journey, including a withdrawal between scheduler ticks. */
export async function resolutionSlaStateJourney(
  f: Awaited<ReturnType<typeof setupAdministration>>,
  tick: (at: string) => Promise<void>,
) {
  vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
  expect((await f.call("/settings", "PATCH", { timezone: "UTC" })).status).toBe(
    200,
  );
  const team = (
    await f.mutate("/settings/teams", "POST", {
      name: "synthetic-vector-197",
      identifierPrefix: "SLASTOP",
    })
  ).teams.find((row) => row.identifierPrefix === "SLASTOP")!;
  const path = `/settings/teams/${team.id}/sla`;
  const rule = {
    enabled: true,
    priority: "urgent",
    labelId: null,
    targetMinutes: 10,
    warnBeforeMinutes: 5,
    workingDays: [1, 2, 3, 4, 5],
    startsAt: "09:00",
    endsAt: "17:00",
  };
  expect((await f.call(path, "PUT", rule)).status).toBe(200);
  const issue = await f.create({
    teamId: team.id,
    priority: "urgent",
    assigneeOperatorId: f.owner,
  });
  const read = async () => {
    const response = await f.call(`/issues/${issue.identifier}/sla`);
    expect(response.status).toBe(200);
    return response.json() as Promise<Record<string, unknown>>;
  };
  await tick("2026-11-03T10:03:00Z");
  // Editing the active target and workspace timezone must not rewrite a clock.
  expect(
    (await f.call(path, "PUT", { ...rule, targetMinutes: 20 })).status,
  ).toBe(200);
  expect(
    (await f.call("/settings", "PATCH", { timezone: "Pacific/Honolulu" }))
      .status,
  ).toBe(200);
  expect(await read()).toMatchObject({
    state: "running",
    remainingMinutes: 7,
    targetMinutes: 10,
    timezone: "UTC",
  });
  vi.setSystemTime(new Date("2026-11-03T10:04:00Z"));
  expect(
    (await f.call(`/settings/teams/${team.id}`, "PATCH", { archived: true }))
      .status,
  ).toBe(200);
  vi.setSystemTime(new Date("2026-11-03T10:06:00Z"));
  expect(
    (await f.call(`/settings/teams/${team.id}`, "PATCH", { archived: false }))
      .status,
  ).toBe(200);
  // No scheduled observation took place while the team was archived.
  expect(await read()).toMatchObject({
    state: "stopped",
    stoppedAt: "2026-11-03T10:04:00.000Z",
    remainingMinutes: 6,
  });
  await tick("2026-11-03T10:30:00Z");
  await tick("2026-11-03T10:31:00Z");
  expect(await read()).toMatchObject({ state: "stopped", remainingMinutes: 6 });
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM issue_sla_occurrences WHERE issue_id=?",
    )
      .bind(issue.id)
      .first("n"),
  ).toBe(0);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM notifications WHERE issue_id=? AND causes_json='[\"sla_warning\"]'",
    )
      .bind(issue.id)
      .first("n"),
  ).toBe(0);
  vi.setSystemTime(new Date("2026-11-02T16:26:00Z"));
  expect(
    (await f.call("/settings", "PATCH", { timezone: "America/New_York" }))
      .status,
  ).toBe(200);
}
