import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { invite, actor, request } from "./base-auth-fixture";
import { reminderFixture, tick, effectCounts } from "./due-reminders-fixture";

export async function verifyReminderReassignment(
  f: Awaited<ReturnType<typeof reminderFixture>>,
) {
  await f.configure("UTC");
  const bCookie = await invite("reminder-b@vector.test", f.cookie),
    b = await actor(bCookie);
  const cCookie = await invite("reminder-c@vector.test", f.cookie),
    c = await actor(cCookie);
  const first = await f.create(),
    second = await f.create();
  const mute = async (identifier: string, cookie: string, muted: boolean) =>
    expect(
      (
        await request(
          "/api/issues/" + identifier + "/subscription",
          "PATCH",
          { muted },
          cookie,
        )
      ).status,
    ).toBe(200);
  const move = async (
    issue: typeof first,
    assigneeOperatorId: string,
    expectedVersion: number,
  ) =>
    expect(
      (
        await f.call("/issues/" + issue.identifier, "PATCH", {
          assigneeOperatorId,
          expectedVersion,
        })
      ).status,
    ).toBe(200);
  const inbox = async (cookie: string) => {
    const response = await request(
      "/api/notifications",
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
      (n) =>
        n.causes.includes("due_reminder") &&
        [first.identifier, second.identifier].includes(n.identifier),
    );
  };
  await mute(first.identifier, f.cookie, true);
  await mute(second.identifier, f.cookie, true);
  const beforeMuted = await effectCounts();
  await tick("2026-10-11T09:01:00Z");
  expect(await effectCounts()).toEqual(beforeMuted);
  await mute(first.identifier, bCookie, true);
  await move(first, b, 1);
  await move(second, b, 1);
  const beforeB = await effectCounts();
  await tick("2026-10-11T09:02:00Z");
  expect((await inbox(bCookie)).map((n) => n.identifier)).toEqual([
    second.identifier,
  ]);
  expect(await effectCounts()).toEqual({
    ...beforeB,
    audit_records: beforeB.audit_records + 1,
  });
  await mute(first.identifier, f.cookie, false);
  await mute(second.identifier, f.cookie, false);
  await move(first, f.owner, 2);
  await move(second, f.owner, 2);
  await tick("2026-10-11T09:03:00Z");
  expect(await inbox(f.cookie)).toHaveLength(0);
  await move(first, c, 3);
  const beforeC = await effectCounts();
  await tick("2026-10-11T09:04:00Z");
  expect((await inbox(cCookie)).map((n) => n.identifier)).toEqual([
    first.identifier,
  ]);
  expect(await effectCounts()).toEqual({
    ...beforeC,
    audit_records: beforeC.audit_records + 1,
  });
  await mute(first.identifier, bCookie, false);
  await move(first, b, 4);
  await tick("2026-10-11T09:05:00Z");
  expect((await inbox(bCookie)).map((n) => n.identifier)).toEqual([
    second.identifier,
  ]);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM due_reminders WHERE issue_id IN (?,?)",
    )
      .bind(first.id, second.id)
      .first("n"),
  ).toBe(2);
  expect(
    (
      await env.DB.prepare(
        "SELECT issue_id,operator_id FROM due_reminder_suppressions WHERE issue_id IN (?,?) ORDER BY issue_id,operator_id",
      )
        .bind(first.id, second.id)
        .all()
    ).results,
  ).toEqual(
    [
      { issue_id: first.id, operator_id: f.owner },
      { issue_id: first.id, operator_id: b },
      { issue_id: second.id, operator_id: f.owner },
    ].sort(
      (a, b) =>
        a.issue_id.localeCompare(b.issue_id) ||
        a.operator_id.localeCompare(b.operator_id),
    ),
  );
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM audit_records WHERE action='due_reminder.delivered' AND subject_id IN (?,?)",
    )
      .bind(first.id, second.id)
      .first("n"),
  ).toBe(2);
}
