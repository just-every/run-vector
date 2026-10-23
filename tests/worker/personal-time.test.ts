import { env } from "cloudflare:workers";
import { expect, it, vi } from "vitest";
import { contractWith } from "../contract-tags";
import { actor, bindings, invite, request } from "./base-auth-fixture";
import { setupAdministration } from "./administration-fixture";
import { scheduled } from "../../src/core/app/scheduled";
import { mentionToken } from "../../src/core/features/notifications/mention-token";
import {
  beforeReminderClaim,
  reminderFixture,
  tick,
} from "./due-reminders-fixture";

contractWith(
  it,
  "NOTIFY-010 NOTIFY-005 NOTIFY-007 OPS-003",
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
        timezone: string | null;
        effectiveTimezone: string;
        workingDays: number[];
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
      await save(pacificCookie, {
        ...preferences,
        workingDays: [5, 3, 1, 4, 2],
      }),
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
    await digestClockScenario(f, pacificCookie, pacific);
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

/** Native choices enqueue real Inbox events; only the SendGrid boundary is replaced. */
async function digestClockScenario(
  f: Awaited<ReturnType<typeof reminderFixture>>,
  cookie: string,
  person: string,
) {
  const own = (path: string, method: string, body: unknown) =>
    request("/api" + path, method, body, cookie);
  const save = async (path: string, method: string, body: unknown) => {
    const response = await own(path, method, body);
    expect(response.status, await response.clone().text()).toBe(200);
  };
  await f.configure("America/New_York");
  await save("/settings/personal-time", "PATCH", {
    timezone: "America/Los_Angeles", workingHoursStart: "09:00",
    workingHoursEnd: "17:00", workingDays: [1, 2, 3, 4, 5],
  });
  await save("/settings/notifications", "PATCH", { emailEnabled: true });
  await save("/settings/notifications/channels", "PUT", { channels: [
    { kind: "mention", emailMode: "daily", slack: false },
    { kind: "comment", emailMode: "hourly", slack: false },
  ] });
  const received: { personalizations: { to: { email: string }[] }[]; content: { value: string }[] }[] = [];
  let mode: "accepted" | "retry" | "uncertain" = "accepted";
  const network = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    expect(new URL(String(input)).origin).toBe("https://api.sendgrid.com");
    expect(init).toMatchObject({ method: "POST", redirect: "manual" });
    received.push(JSON.parse(String(init?.body)));
    if (mode === "uncertain") throw Error("Provider acknowledgement lost");
    return new Response(null, { status: mode === "retry" ? 429 : 202 });
  });
  const runtime = { ...bindings, APP_ORIGIN: "https://vector.test", MAIL_MODE: "production",
    MAIL_PROVIDER: "sendgrid", MAIL_API_KEY: "synthetic-vector-1001", NOTIFICATION_EMAIL_ENABLED: "true" };
  const at = async (instant: string) => {
    vi.setSystemTime(new Date(instant));
    await scheduled({ scheduledTime: Date.parse(instant) }, runtime);
  };
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2026-10-16T23:59:00Z")); // Friday 16:59 Pacific.
    const daily = await f.create({ title: "Pacific daily digest", dueDate: null,
      description: mentionToken({ id: person, name: "Pacific" }) + " PRIVATE_DIGEST_DESCRIPTION" });
    const hourly = await f.create({ title: "Pacific hourly digest", dueDate: null });
    await save("/issues/" + hourly.identifier + "/subscription", "PATCH", { following: true });
    const comment = async (identifier = hourly.identifier) => {
      const response = await f.call("/issues/" + identifier + "/comments", "POST", { body: "PRIVATE_DIGEST_COMMENT" });
      expect(response.status).toBe(201);
    };
    await comment();
    // End of work, Saturday, and the workspace's Monday 09:00 are all closed for this member.
    for (const instant of ["2026-10-17T00:00:00Z", "2026-10-17T16:00:00Z", "2026-10-19T13:00:00Z", "2026-10-19T15:59:00Z"])
      await at(instant);
    expect(received).toHaveLength(0);
    await at("2026-10-19T16:00:00Z");
    expect(received).toHaveLength(2);
    const texts = received.map(message => message.content.map(part => part.value).join("\n"));
    expect(texts.filter(text => text.includes(daily.identifier))).toHaveLength(1);
    expect(texts.filter(text => text.includes(hourly.identifier))).toHaveLength(1);
    expect(received.every(message => message.personalizations[0].to[0].email === "pacific@personal-time.test")).toBe(true);
    for (const text of texts) {
      expect(text).toContain("Owner");
      expect(text).not.toMatch(/PRIVATE_DIGEST_|pacific@personal-time\.test|synthetic-vector-1001/);
    }
    await at("2026-10-19T16:00:00Z");
    vi.setSystemTime(new Date("2026-10-19T16:10:00Z"));
    await comment();
    await at("2026-10-19T16:59:00Z");
    expect(received).toHaveLength(2);
    // A definitive refusal retries only when due; the accepted envelope then stays terminal.
    mode = "retry";
    await at("2026-10-19T17:00:00Z");
    expect(received).toHaveLength(3);
    await at("2026-10-19T17:00:30Z");
    expect(received).toHaveLength(3);
    mode = "accepted";
    await at("2026-10-19T17:01:00Z");
    expect(received).toHaveLength(4);
    await at("2026-10-19T17:02:00Z");
    expect(received).toHaveLength(4);
    // An old-window retry consumes the next working slot; new arrivals carry forward intact.
    await comment();
    mode = "retry";
    await at("2026-10-19T18:00:00Z");
    expect(received).toHaveLength(5);
    vi.setSystemTime(new Date("2026-10-19T18:10:00Z"));
    const nextSlot = await f.create({ title: "Next hourly slot", dueDate: null });
    await save("/issues/" + nextSlot.identifier + "/subscription", "PATCH", { following: true });
    await comment(nextSlot.identifier);
    mode = "accepted";
    await at("2026-10-19T19:00:00Z");
    expect(received).toHaveLength(6);
    expect(received[5]).toEqual(received[4]);
    const retried = received[5].content.map(part => part.value).join("\n");
    expect(retried).toContain(hourly.identifier);
    expect(retried).not.toContain(nextSlot.identifier);
    await at("2026-10-19T19:01:00Z");
    expect(received).toHaveLength(6);
    await at("2026-10-19T20:00:00Z");
    expect(received).toHaveLength(7);
    const carried = received[6].content.map(part => part.value).join("\n");
    expect(carried).toContain(nextSlot.identifier);
    expect(carried).not.toContain(hourly.identifier);
    await at("2026-10-19T20:01:00Z");
    expect(received).toHaveLength(7);
    // A mute after enqueue is rechecked before the digest leaves the process.
    await comment();
    await save("/settings/notifications", "PATCH", { mutedKinds: ["comment"] });
    await at("2026-10-19T21:00:00Z");
    expect(received).toHaveLength(7);
    await save("/settings/notifications", "PATCH", { mutedKinds: [] });
    await comment();
    mode = "uncertain";
    await at("2026-10-19T22:00:00Z");
    expect(received).toHaveLength(8);
    mode = "accepted";
    await at("2026-10-19T22:01:00Z");
    await at("2026-10-19T23:00:00Z");
    expect(received).toHaveLength(8);
    const response = await request("/api/settings/notifications/channels", "GET", undefined, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ digestDeliveries: [{ status: "uncertain", attempts: 1 }] });
  } finally {
    vi.useRealTimers();
    network.mockRestore();
  }
}

it("a Guest saving their time gets back only their own time, never members outside their teams", async () => {
  const f = await setupAdministration();
  const outsiderEmail = "outside-member@personal-time.test", outsider = await actor(await invite(outsiderEmail, f.cookie));
  const guestCookie = await invite("time-guest@personal-time.test", f.cookie), guest = await actor(guestCookie);
  const team = (await f.mutate("/settings/teams", "POST", { name: "Guest time", identifierPrefix: "GTIME" })).teams.find((t) => t.name === "Guest time")!;
  expect((await f.call(`/settings/operators/${guest}/role`, "PATCH", { role: "guest", teamIds: [team.id] })).status).toBe(200);
  const saved = await request("/api/settings/personal-time", "PATCH", { timezone: null, workingHoursStart: "08:00", workingHoursEnd: "16:00", workingDays: [1, 2, 3, 4, 5] }, guestCookie);
  expect(saved.status).toBe(200);
  const body = await saved.text();
  for (const hidden of [outsider, outsiderEmail, "outside-member"]) expect(body).not.toContain(hidden);
  expect(JSON.parse(body)).toEqual(await (await request("/api/settings/personal-time", "GET", undefined, guestCookie)).json());
});
