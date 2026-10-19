import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { actor, invite, request } from "./base-auth-fixture";
import {
  beforeReminderClaim,
  reminderFixture,
  tick,
} from "./due-reminders-fixture";

contractWith(
  it,
  "NOTIFY-010 NOTIFY-005 OPS-003",
  "personal clocks inherit workspace time, isolate settings and fence exactly-once scheduled reminders",
  async () => {
    const f = await reminderFixture();
    await f.configure("America/New_York");
    const pacificCookie = await invite("pacific@personal-time.test", f.cookie);
    const pacific = await actor(pacificCookie);
    const path = "/api/settings/personal-time";
    const defaults = {
      timezone: null,
      workingHoursStart: "09:00",
      workingHoursEnd: "17:00",
      workingDays: [1, 2, 3, 4, 5],
    };
    const read = async (cookie: string) => {
      const response = await request(path, "GET", undefined, cookie);
      expect(response.status).toBe(200);
      return (await response.json()) as typeof defaults & {
        effectiveTimezone: string;
        workspaceTimezone: string;
        reminderTime: string;
      };
    };
    const save = async (cookie: string, values: Record<string, unknown>) => {
      const response = await request(path, "PATCH", values, cookie);
      expect(response.status).toBe(200);
      return (await response.json()) as {
        personalTime: {
          timezone: string | null;
          effectiveTimezone: string;
          workingDays: number[];
        };
      };
    };
    expect(await read(f.cookie)).toMatchObject({
      ...defaults,
      effectiveTimezone: "America/New_York",
    });
    expect((await request(path)).status).toBe(401);
    expect((await request(path, "PATCH", defaults)).status).toBe(401);
    const preferences = { ...defaults, timezone: "America/Los_Angeles" };
    expect(
      (
        await save(pacificCookie, {
          ...preferences,
          workingDays: [5, 3, 1, 4, 2],
        })
      ).personalTime,
    ).toMatchObject({
      timezone: preferences.timezone,
      effectiveTimezone: preferences.timezone,
      workingDays: defaults.workingDays,
    });
    for (const invalid of [
      { timezone: "Mars/Olympus" },
      { timezone: "+03:00" },
      { workingHoursStart: "24:00" },
      { workingHoursEnd: "08:00" },
      { workingHoursEnd: "09:00" },
      { workingDays: [] },
      { workingDays: [0, 1] },
      { workingDays: [1, 1] },
      { operatorId: f.owner, timezone: "Asia/Tokyo" },
    ])
      expect(
        (
          await request(
            path,
            "PATCH",
            { ...preferences, ...invalid },
            pacificCookie,
          )
        ).status,
      ).toBe(400);
    expect(await read(f.cookie)).toMatchObject({
      ...defaults,
      effectiveTimezone: "America/New_York",
    });
    expect(await read(pacificCookie)).toMatchObject({
      ...preferences,
      effectiveTimezone: preferences.timezone,
    });
    // Even a caller-supplied target in the URL cannot redirect the current-member read.
    const targeted = await request(
      path + "?operatorId=" + f.owner,
      "GET",
      undefined,
      pacificCookie,
    );
    expect(targeted.status).toBe(200);
    expect(await targeted.json()).toMatchObject({
      timezone: preferences.timezone,
    });

    const easternIssue = await f.create({ dueDate: "2026-10-12" });
    const pacificIssue = await f.create({
      dueDate: "2026-10-12",
      assigneeOperatorId: pacific,
    });
    const delivered = async (cookie: string, identifier: string) => {
      const response = await request(
        "/api/notifications",
        "GET",
        undefined,
        cookie,
      );
      expect(response.status).toBe(200);
      const page = (await response.json()) as {
        items: { identifier: string; causes: string[]; createdAt: string }[];
      };
      return page.items.filter(
        (item) =>
          item.identifier === identifier &&
          item.causes.includes("due_reminder"),
      );
    };
    await tick("2026-10-12T12:59:00Z");
    expect(await delivered(f.cookie, easternIssue.identifier)).toHaveLength(0);
    expect(
      await delivered(pacificCookie, pacificIssue.identifier),
    ).toHaveLength(0);
    await Promise.all([
      tick("2026-10-12T13:00:00Z"),
      tick("2026-10-12T13:00:00Z"),
    ]);
    expect(await delivered(f.cookie, easternIssue.identifier)).toMatchObject([
      { createdAt: "2026-10-12T13:00:00.000Z" },
    ]);
    expect(
      await delivered(pacificCookie, pacificIssue.identifier),
    ).toHaveLength(0);
    await tick("2026-10-12T15:59:00Z");
    expect(
      await delivered(pacificCookie, pacificIssue.identifier),
    ).toHaveLength(0);
    await Promise.all([
      tick("2026-10-12T16:00:00Z"),
      tick("2026-10-12T16:00:00Z"),
    ]);
    await tick("2026-10-12T16:05:00Z");
    expect(await delivered(f.cookie, easternIssue.identifier)).toHaveLength(1);
    expect(
      await delivered(pacificCookie, pacificIssue.identifier),
    ).toMatchObject([{ createdAt: "2026-10-12T16:00:00.000Z" }]);

    // A zone edit between observation and claim must defer until the new local time.
    const moved = await f.create({
      dueDate: "2026-10-12",
      assigneeOperatorId: pacific,
    });
    await tick(
      "2026-10-12T16:06:00Z",
      beforeReminderClaim(() =>
        save(pacificCookie, { ...preferences, timezone: "Pacific/Honolulu" }),
      ),
    );
    expect(await delivered(pacificCookie, moved.identifier)).toHaveLength(0);
    await tick("2026-10-12T18:59:00Z");
    expect(await delivered(pacificCookie, moved.identifier)).toHaveLength(0);
    await tick("2026-10-12T19:00:00Z");
    expect(await delivered(pacificCookie, moved.identifier)).toHaveLength(1);

    // Working preferences also invalidate the observation without consuming its receipt.
    let current = { ...preferences };
    for (const change of [
      { workingHoursStart: "10:00" },
      { workingHoursEnd: "18:00" },
      { workingDays: [1, 3, 5] },
    ]) {
      await save(pacificCookie, current);
      const issue = await f.create({
        dueDate: "2026-10-12",
        assigneeOperatorId: pacific,
      });
      current = { ...current, ...change };
      await tick(
        "2026-10-12T19:01:00Z",
        beforeReminderClaim(() => save(pacificCookie, current)),
      );
      expect(await delivered(pacificCookie, issue.identifier)).toHaveLength(0);
      await tick("2026-10-12T19:02:00Z");
      expect(await delivered(pacificCookie, issue.identifier)).toHaveLength(1);
    }
    // Removing an override resumes live inheritance rather than storing a workspace copy.
    await save(pacificCookie, defaults);
    await f.configure("Asia/Tokyo");
    expect(await read(pacificCookie)).toMatchObject({
      timezone: null,
      effectiveTimezone: "Asia/Tokyo",
    });
    expect(
      await env.DB.prepare("SELECT timezone FROM workspace_settings").first(
        "timezone",
      ),
    ).toBe("Asia/Tokyo");
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM due_reminders WHERE issue_id IN (?,?)",
      )
        .bind(easternIssue.id, pacificIssue.id)
        .first("n"),
    ).toBe(2);
    expect(
      (await f.call("/settings/operators/" + pacific, "DELETE")).status,
    ).toBe(200);
    expect((await request(path, "GET", undefined, pacificCookie)).status).toBe(
      401,
    );
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM operator_personal_time WHERE operator_id=?",
      )
        .bind(pacific)
        .first("n"),
    ).toBe(0);
  },
);
