import { env } from "cloudflare:workers";
import { afterEach, expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { bindings } from "./base-auth-fixture";
import {
  CLAIM_TIMEOUT_MS,
  drainNotificationMail,
  type Delivery,
  type MailResult,
} from "../../src/core/features/notifications/mail";
import { removeOperator } from "../../src/core/features/settings/removal";

afterEach(async () => {
  // Each independent erasure case signs in the same fixture owner.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM access_rate_limits"),
    env.DB.prepare("DELETE FROM oa_limits"),
  ]);
});

const remote = {
  ...bindings,
  APP_ORIGIN: "https://vector.example.test",
  MAIL_MODE: "sendgrid",
  MAIL_PROVIDER: "sendgrid",
  MAIL_API_KEY: "test-recording-only-key",
};
type Erasure = "issue" | "recipient";
async function erase(
  fixture: Awaited<ReturnType<typeof collaborationFixture>>,
  identifier: string,
  kind: Erasure,
) {
  if (kind === "recipient")
    await removeOperator(env.DB, fixture.owner, fixture.bob);
  else
    await env.DB.prepare("DELETE FROM issues WHERE identifier=?")
      .bind(identifier)
      .run();
}
async function expectErased(delivery: Delivery) {
  for (const [table, where, value] of [
    ["notifications", "id=?", delivery.notification_id],
    ["notification_deliveries", "id=?", delivery.id],
    ["notification_delivery_attempts", "delivery_id=?", delivery.id],
    ["notification_development_mail", "delivery_id=?", delivery.id],
  ])
    expect(await count(table, where, [value]), table).toBe(0);
}
async function audit(identifier: string) {
  return (
    await env.DB.prepare(
      "SELECT * FROM notification_mail_audit WHERE subject_identifier=?",
    )
      .bind(identifier)
      .all()
  ).results;
}

for (const kind of ["issue", "recipient"] as const) {
  for (const outcome of ["accepted", "uncertain"] as const) {
    contractWith(
      it,
      "NOTIFY-006 BASE-DATA-003 BASE-OPS-003 BASE-OPS-005",
      `Base ${outcome} after ${kind} erasure during transport retains only a known acceptance audit and never replays`,
      async () => {
        const f = await collaborationFixture();
        const issue = await f.pending({}, remote);
        const clock = new Date();
        const calls: string[] = [];
        let erased = false;
        let submitted: Delivery | undefined;
        let result: MailResult | undefined;
        const recording: typeof fetch = async (_request, init) => {
          calls.push(String(init?.body));
          await erase(f, issue.identifier, kind);
          erased = true;
          if (outcome === "uncertain") throw new Error("transport interrupted");
          return new Response(null, { status: 202 });
        };
        await drainNotificationMail(remote, {
          now: clock,
          dependencies: {
            fetch: recording,
            afterSubmission: async (delivery, received) => {
              submitted = delivery;
              result = received;
            },
          },
        });
        expect(erased).toBe(true);
        expect(calls).toHaveLength(1);
        expect(JSON.parse(calls[0]).personalizations[0].to).toHaveLength(1);
        expect(result?.status).toBe(outcome);
        expect(submitted?.claim_token).toEqual(expect.any(String));
        await expectErased(submitted!);
        const expected =
          outcome === "accepted"
            ? [
                {
                  id: submitted!.claim_token,
                  feature: "notification.mail",
                  subject_identifier: issue.identifier,
                  outcome: "accepted",
                  created_at: clock.toISOString(),
                },
              ]
            : [];
        expect(await audit(issue.identifier)).toEqual(expected);
        await drainNotificationMail(remote, {
          dependencies: { fetch: recording },
        });
        await drainNotificationMail(remote, {
          scheduled: true,
          now: new Date(clock.getTime() + CLAIM_TIMEOUT_MS + 1000),
          dependencies: { fetch: recording },
        });
        expect(calls).toHaveLength(1);
        await expectErased(submitted!);
        expect(await audit(issue.identifier)).toEqual(expected);
      },
    );
  }
  contractWith(
    it,
    "NOTIFY-006 BASE-DATA-003 BASE-OPS-003 BASE-OPS-005",
    `Base development capture followed by ${kind} erasure retains only its safe audit`,
    async () => {
      const f = await collaborationFixture();
      const issue = await f.pending();
      const clock = new Date();
      let submitted: Delivery | undefined;
      await drainNotificationMail(bindings, {
        now: clock,
        dependencies: {
          afterSubmission: async (delivery, result) => {
            submitted = delivery;
            expect(result.status).toBe("development");
            expect(
              await count("notification_development_mail", "delivery_id=?", [
                delivery.id,
              ]),
            ).toBe(1);
            await erase(f, issue.identifier, kind);
          },
        },
      });
      expect(submitted?.claim_token).toEqual(expect.any(String));
      await expectErased(submitted!);
      const expected = [
        {
          id: submitted!.claim_token,
          feature: "notification.mail",
          subject_identifier: issue.identifier,
          outcome: "development",
          created_at: clock.toISOString(),
        },
      ];
      expect(await audit(issue.identifier)).toEqual(expected);
      await drainNotificationMail(bindings);
      await drainNotificationMail(bindings, {
        scheduled: true,
        now: new Date(clock.getTime() + CLAIM_TIMEOUT_MS + 1000),
      });
      await expectErased(submitted!);
      expect(await audit(issue.identifier)).toEqual(expected);
    },
  );
}
