import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { request, bindings } from "./base-auth-fixture";
import { drainNotificationMail } from "../../src/core/features/notifications/mail";
import { changePreferences } from "../../src/core/features/notifications/mutations";
import { removeOperator } from "../../src/core/features/settings/removal";
import { mentionToken } from "../../src/core/features/notifications/mention-token";
contractWith(
  it,
  "NOTIFY-006 NOTIFY-003 BASE-DATA-004",
  "disabled or unavailable capability and opted-out recipients create no intent while own inbox remains active",
  async () => {
    const f = await collaborationFixture();
    const body = {
      title: "Eligibility",
      teamId: f.initial.teams[0].id,
      assigneeOperatorId: f.bob,
    };
    expect(
      (
        await request("/api/issues", "POST", body, f.cookie, {
          NOTIFICATION_EMAIL_ENABLED: "false",
        })
      ).status,
    ).toBe(201);
    expect(await count("notification_deliveries")).toBe(0);
    expect(await count("notifications", "recipient_id=?", [f.bob])).toBe(1);
    // Authentication stays correctly configured; direct source capability-off path
    // is exercised independently of auth's mandatory configuration validation.
    await changePreferences(env.DB, f.bob, { emailEnabled: false });
    await f.create(body);
    expect(await count("notification_deliveries")).toBe(0);
    await f.create({
      description: mentionToken({ id: f.owner, name: "Owner" }),
      assigneeOperatorId: f.owner,
    });
    expect(await count("notifications", "recipient_id=?", [f.owner])).toBe(0);
    await changePreferences(env.DB, f.bob, { emailEnabled: true });
    await f.pending();
    let calls = 0;
    await drainNotificationMail(
      { ...bindings, NOTIFICATION_EMAIL_ENABLED: "false" },
      {
        dependencies: {
          fetch: async () => {
            calls++;
            return new Response(null, { status: 202 });
          },
        },
      },
    );
    expect(calls).toBe(0);
    expect(await count("notification_deliveries", "status='suppressed'")).toBe(
      1,
    );
  },
);
contractWith(
  it,
  "NOTIFY-006 OPS-004 BASE-OPS-004",
  "removed recipients fail final admission and a definitely rejected attempt can recover once on Cron",
  async () => {
    const f = await collaborationFixture();
    await f.pending();
    const remote = {
      ...bindings,
      APP_ORIGIN: "https://vector.example.test",
      MAIL_MODE: "sendgrid",
      MAIL_PROVIDER: "sendgrid",
      MAIL_API_KEY: "test-recording-only-key",
    };
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      return new Response(null, { status: calls === 1 ? 400 : 202 });
    };
    const now = new Date();
    await drainNotificationMail(remote, {
      now,
      dependencies: { fetch: transport },
    });
    expect(await count("notification_deliveries", "status='retry'")).toBe(1);
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(now.getTime() + 60_000),
      dependencies: { fetch: transport },
    });
    expect(calls).toBe(2);
    expect(
      await count(
        "notification_deliveries",
        "status='accepted' AND attempts=2",
      ),
    ).toBe(1);
    await f.pending();
    await drainNotificationMail(remote, {
      dependencies: {
        fetch: transport,
        beforeAdmission: async () => removeOperator(env.DB, f.owner, f.bob),
      },
    });
    expect(calls).toBe(2);
    expect(await count("notification_deliveries")).toBe(0);
    expect(await count("notification_delivery_attempts")).toBe(0);
  },
);
