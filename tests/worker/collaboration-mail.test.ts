import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { bindings } from "./base-auth-fixture";
import {
  drainNotificationMail,
  CLAIM_TIMEOUT_MS,
} from "../../src/core/features/notifications/mail";
import {
  changeSubscription,
  changePreferences,
} from "../../src/core/features/notifications/mutations";
import { removeOperator } from "../../src/core/features/settings/removal";
const remote = {
  ...bindings,
  APP_ORIGIN: "https://vector.example.test",
  MAIL_MODE: "sendgrid",
  MAIL_PROVIDER: "sendgrid",
  MAIL_API_KEY: "test-recording-only-key",
};
contractWith(
  it,
  "NOTIFY-006 BASE-DATA-004 BASE-OPS-003 BASE-OPS-004",
  "real Base facade sends one minimal request across competing drains and never replays accepted or uncertain outcomes",
  async () => {
    const f = await collaborationFixture();
    await f.pending(
      {
        description: "SECRET_BODY_SENTINEL",
        expectedOutcome: "SECRET_OUTCOME",
      },
      remote,
    );
    const calls: string[] = [];
    const recording: typeof fetch = async (_request, init) => {
      calls.push(String(init?.body));
      return new Response(null, { status: 202 });
    };
    await Promise.all([
      drainNotificationMail(remote, { dependencies: { fetch: recording } }),
      drainNotificationMail(remote, { dependencies: { fetch: recording } }),
    ]);
    expect(calls).toHaveLength(1);
    const wire = JSON.parse(calls[0]);
    expect(wire.content).toHaveLength(1);
    expect(wire.content[0].type).toBe("text/plain");
    expect(calls[0]).not.toContain("SECRET_BODY_SENTINEL");
    expect(calls[0]).not.toContain("SECRET_OUTCOME");
    expect(calls[0]).not.toContain("attachments");
    expect(wire.tracking_settings.click_tracking.enable).toBe(false);
    expect(wire.tracking_settings.open_tracking.enable).toBe(false);
    expect(wire.content[0].value).toContain("Sign in to view");
    expect(wire.content[0].value).toContain(
      "https://vector.example.test/app/issues/BASE-",
    );
    await drainNotificationMail(remote, {
      scheduled: true,
      dependencies: { fetch: recording },
    });
    expect(calls).toHaveLength(1);
    await f.pending({}, remote);
    const uncertain: typeof fetch = async () => {
      calls.push("uncertain");
      throw new Error("test timeout");
    };
    await drainNotificationMail(remote, { dependencies: { fetch: uncertain } });
    expect(await count("notification_deliveries", "status='uncertain'")).toBe(
      1,
    );
    await drainNotificationMail(remote, {
      scheduled: true,
      dependencies: { fetch: recording },
    });
    expect(calls).toHaveLength(2);
    const prefs = await f.data(f.bobCookie, "/settings/notifications");
    expect(prefs.deliveries[0].status).toBe("uncertain");
  },
);
contractWith(
  it,
  "NOTIFY-006 BASE-OPS-003 BASE-OPS-004",
  "definite rejections retry only on cron, finitely; crash after claim or accepted submission remains non-replayable",
  async () => {
    const f = await collaborationFixture(),
      clock = new Date();
    await f.pending({}, remote);
    let calls = 0;
    const reject: typeof fetch = async () => {
      calls++;
      return new Response(null, { status: 429 });
    };
    await drainNotificationMail(remote, {
      now: clock,
      dependencies: { fetch: reject },
    });
    expect(calls).toBe(1);
    await drainNotificationMail(remote, {
      now: new Date(clock.getTime() + 60_000),
      dependencies: { fetch: reject },
    });
    expect(calls).toBe(1);
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(clock.getTime() + 60_000),
      dependencies: { fetch: reject },
    });
    expect(calls).toBe(2);
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(clock.getTime() + 360_000),
      dependencies: { fetch: reject },
    });
    expect(calls).toBe(3);
    expect(
      await count(
        "notification_deliveries",
        "status='failed' AND reason='retry_exhausted'",
      ),
    ).toBe(1);
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(clock.getTime() + 7200_000),
      dependencies: { fetch: reject },
    });
    expect(calls).toBe(3);
    await f.pending({}, remote);
    await expect(
      drainNotificationMail(remote, {
        dependencies: {
          beforeAdmission: async () => {
            throw new Error("claim crash");
          },
          fetch: reject,
        },
      }),
    ).rejects.toThrow("claim crash");
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(Date.now() + CLAIM_TIMEOUT_MS + 1000),
      dependencies: { fetch: reject },
    });
    expect(await count("notification_deliveries", "status='uncertain'")).toBe(
      1,
    );
    expect(calls).toBe(3);
    await f.pending({}, remote);
    const accepted: typeof fetch = async () => {
      calls++;
      return new Response(null, { status: 202 });
    };
    await expect(
      drainNotificationMail(remote, {
        dependencies: {
          fetch: accepted,
          afterSubmission: async () => {
            throw new Error("settlement persistence crash");
          },
        },
      }),
    ).rejects.toThrow("settlement persistence crash");
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(Date.now() + CLAIM_TIMEOUT_MS + 1000),
      dependencies: { fetch: accepted },
    });
    expect(await count("notification_deliveries", "status='uncertain'")).toBe(
      2,
    );
    expect(calls).toBe(4);
  },
);
contractWith(
  it,
  "NOTIFY-006 NOTIFY-004 OPS-004 BASE-DATA-003",
  "final admission observes opt-out and issue mute, erasure removes intents/captures, and late settlement cannot resurrect them",
  async () => {
    const f = await collaborationFixture();
    let calls = 0;
    const recording: typeof fetch = async () => {
      calls++;
      return new Response(null, { status: 202 });
    };
    const issue = await f.pending({}, remote);
    await drainNotificationMail(remote, {
      dependencies: {
        fetch: recording,
        beforeAdmission: async () =>
          changeSubscription(env.DB, f.bob, issue.identifier, { muted: true }),
      },
    });
    expect(calls).toBe(0);
    expect(await count("notification_deliveries", "status='suppressed'")).toBe(
      1,
    );
    await f.pending({}, remote);
    await drainNotificationMail(remote, {
      dependencies: {
        fetch: recording,
        beforeAdmission: async () =>
          changePreferences(env.DB, f.bob, { emailEnabled: false }),
      },
    });
    expect(calls).toBe(0);
    await changePreferences(env.DB, f.bob, { emailEnabled: true });
    const late = await f.pending({}, remote);
    const erase: typeof fetch = async () => {
      calls++;
      await env.DB.prepare("DELETE FROM issues WHERE identifier=?")
        .bind(late.identifier)
        .run();
      return new Response(null, { status: 202 });
    };
    await drainNotificationMail(remote, { dependencies: { fetch: erase } });
    expect(calls).toBe(1);
    expect(
      await count("notification_deliveries", "identifier=?", [late.identifier]),
    ).toBe(0);
    await f.pending({}, remote);
    await drainNotificationMail(bindings);
    expect(await count("notification_development_mail")).toBe(1);
    await removeOperator(env.DB, f.owner, f.bob);
    for (const table of [
      "notification_deliveries",
      "notification_development_mail",
      "notification_delivery_attempts",
      "notification_preferences",
      "issue_notification_mutes",
      "notifications",
    ])
      expect(await count(table), table).toBe(0);
  },
);
