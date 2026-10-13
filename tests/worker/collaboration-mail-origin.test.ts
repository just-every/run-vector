import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture } from "./collaboration-fixture";
import { bindings } from "./base-auth-fixture";
import { notificationEmailAvailable } from "../../src/core/features/notifications/context";
contractWith(
  it,
  "NOTIFY-006 BASE-DATA-004",
  "mail links use validated canonical URL origin even for empty delimiters, case and default ports",
  async () => {
    const f = await collaborationFixture();
    const remote = {
      ...bindings,
      MAIL_MODE: "sendgrid",
      MAIL_PROVIDER: "sendgrid",
      MAIL_API_KEY: "test-recording-only-key",
    };
    for (const APP_ORIGIN of [
      "https://vector.example.test/?",
      "https://vector.example.test/#",
      "https://VECTOR.EXAMPLE.TEST:443/",
      "https://vector.example.test/",
    ]) {
      const current = { ...remote, APP_ORIGIN };
      expect(notificationEmailAvailable(current)).toBe(true);
      const issue = await f.pending({}, current);
      const link = await env.DB.prepare(
        "SELECT app_link FROM notification_deliveries WHERE identifier=?",
      )
        .bind(issue.identifier)
        .first<string>("app_link");
      expect(link).toBe(
        `https://vector.example.test/app/issues/${issue.identifier}`,
      );
      expect(new URL(link!).search).toBe("");
      expect(new URL(link!).hash).toBe("");
    }
    for (const APP_ORIGIN of [
      "https://vector.example.test/private",
      "https://vector.example.test/?query=1",
      "https://vector.example.test/#fragment",
      "https://user@vector.example.test/",
      "http://vector.example.test/",
    ])
      expect(notificationEmailAvailable({ ...remote, APP_ORIGIN })).toBe(false);
  },
);
