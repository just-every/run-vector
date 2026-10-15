import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { bindings } from "./base-auth-fixture";
import { drainNotificationMail } from "../../src/core/features/notifications/mail";
import {
  changePreferences,
  changeSubscription,
} from "../../src/core/features/notifications/mutations";
import { mentionToken } from "../../src/core/features/notifications/mention-token";
contractWith(
  it,
  "NOTIFY-004 NOTIFY-006 BASE-DATA-003",
  "final admission evaluates each current email cause and respects preclaim issue erasure or opt-out",
  async () => {
    const f = await collaborationFixture(),
      token = mentionToken({ id: f.bob, name: "Bob" });
    const remote = {
      ...bindings,
      APP_ORIGIN: "https://vector.example.test",
      MAIL_MODE: "sendgrid",
      MAIL_PROVIDER: "sendgrid",
      MAIL_API_KEY: "synthetic-test-recording-only-key",
    };
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      return new Response(null, { status: 202 });
    };
    await f.pending({ description: token }, remote);
    await drainNotificationMail(remote, {
      dependencies: {
        fetch: transport,
        beforeAdmission: () =>
          changePreferences(env.DB, f.bob, { mutedKinds: ["assignment"] }),
      },
    });
    expect(calls).toBe(1);
    await changePreferences(env.DB, f.bob, { mutedKinds: [] });
    await f.pending({ description: token }, remote);
    await drainNotificationMail(remote, {
      dependencies: {
        fetch: transport,
        beforeAdmission: () =>
          changePreferences(env.DB, f.bob, {
            mutedKinds: ["assignment", "mention"],
          }),
      },
    });
    expect(calls).toBe(1);
    expect(await count("notification_deliveries", "status='suppressed'")).toBe(
      1,
    );
    await changePreferences(env.DB, f.bob, { mutedKinds: [] });
    const erased = await f.pending({}, remote);
    await env.DB.prepare("DELETE FROM issues WHERE identifier=?")
      .bind(erased.identifier)
      .run();
    await drainNotificationMail(remote, { dependencies: { fetch: transport } });
    expect(calls).toBe(1);
    const muted = await f.pending({}, remote);
    await changeSubscription(env.DB, f.bob, muted.identifier, { muted: true });
    await drainNotificationMail(remote, { dependencies: { fetch: transport } });
    expect(calls).toBe(1);
    await f.pending({}, remote);
    await changePreferences(env.DB, f.bob, { emailEnabled: false });
    await drainNotificationMail(remote, { dependencies: { fetch: transport } });
    expect(calls).toBe(1);
  },
);
