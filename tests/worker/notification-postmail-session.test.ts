import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import {
  callPrivate,
  expectPrivateDenial,
} from "./discussion-projection-fixture";
import { request } from "./base-auth-fixture";
import { count } from "./collaboration-fixture";
import { drainNotificationMail } from "../../src/core/features/notifications/mail";
import {
  afterNativeStatement,
  cleanupSessionFixtures,
  notificationSessionFixture,
} from "./notification-session-fixture";

contractWith(
  it,
  "BASE-ACCESS-002 NOTIFY-001 NOTIFY-006",
  "post-mail admission protects the captured session and workspace while preserving exactly one recipient delivery",
  async () => {
    for (const mode of [
      "signout",
      "remove",
      "expire",
      "captured",
      "version",
      "workspace",
      "active",
    ] as const) {
      try {
        const f = await notificationSessionFixture();
        const issue = await f.create({ title: "Before committed assignment" });
        const replacement =
          mode === "captured" ? await f.replacementCookie() : null;
        let mailed = false,
          fired = false;
        const db = afterNativeStatement(async (query) => {
          if (query.includes("INSERT INTO rer_mail_development_outbox"))
            mailed = true;
          if (mailed && !fired && query.includes(f.nativeQuery)) {
            fired = true;
            if (mode !== "active") await f.invalidate(mode);
          }
        });
        const response = await callPrivate(
          `/issues/${issue.identifier}`,
          f.sessionCookie,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              expectedVersion: issue.version,
              title: "Confidential committed assignment",
              assigneeOperatorId: f.cara,
            }),
          },
          { ...f.currentBindings, DB: db },
        );
        expect([mailed, fired]).toEqual([true, true]);
        const body = await response.text();
        if (mode === "active") {
          expect(response.status, body).toBe(200);
          expect(JSON.parse(body).title).toBe(
            "Confidential committed assignment",
          );
        } else expectPrivateDenial(response, body, 401);
        expect(
          await env.DB.prepare(
            "SELECT title,assignee_operator_id,version FROM issues WHERE id=?",
          )
            .bind(issue.id)
            .first(),
        ).toEqual({
          title: "Confidential committed assignment",
          assignee_operator_id: f.cara,
          version: issue.version + 1,
        });
        const deliveries = async () =>
          (
            await env.DB.prepare(
              "SELECT id,status,attempts FROM notification_deliveries WHERE recipient_id=? AND identifier=?",
            )
              .bind(f.cara, issue.identifier)
              .all()
          ).results;
        const committed = await deliveries();
        expect(committed).toEqual([
          { id: expect.any(String), status: "development", attempts: 1 },
        ]);
        const deliveryId = committed[0].id;
        const expectOne = async () => {
          expect(
            await count("notification_development_mail", "delivery_id=?", [
              deliveryId,
            ]),
          ).toBe(1);
          expect(
            await count("notification_delivery_attempts", "delivery_id=?", [
              deliveryId,
            ]),
          ).toBe(1);
        };
        await expectOne();
        await drainNotificationMail(f.currentBindings);
        await drainNotificationMail(f.currentBindings, { scheduled: true });
        expect(await deliveries()).toEqual(committed);
        await expectOne();
        if (replacement)
          expect(
            (
              await request(
                "/api/session",
                "GET",
                undefined,
                replacement,
                f.currentBindings,
              )
            ).status,
          ).toBe(200);
      } finally {
        await cleanupSessionFixtures();
      }
    }
  },
);
