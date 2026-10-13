import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import {
  callPrivate,
  expectPrivateDenial,
} from "./discussion-projection-fixture";
import { request } from "./base-auth-fixture";
import {
  afterNativeStatement,
  cleanupSessionFixtures,
  notificationSessionFixture,
} from "./notification-session-fixture";

for (const hosted of [false, true])
  for (const surface of [
    "inbox",
    "count",
    "preferences",
    "subscription",
  ] as const)
    contractWith(
      it,
      "BASE-ACCESS-002 NOTIFY-004",
      `${hosted ? "hosted Base" : "local Base"} ${surface} retains authorized data and denies every invalidated session after final native authentication`,
      async () => {
        for (const mode of [
          "signout",
          "expire",
          "remove",
          "captured",
          "workspace",
          "version",
        ] as const) {
          try {
            const f = await notificationSessionFixture(hosted);
            const issue = await f.create({
              title: "Confidential notification projection",
              assigneeOperatorId: f.bob,
            });
            const path =
              surface === "inbox"
                ? "/notifications"
                : surface === "count"
                  ? "/notifications/count"
                  : surface === "preferences"
                    ? "/settings/notifications"
                    : `/issues/${issue.identifier}/subscription`;
            const positive = await callPrivate(
              path,
              f.sessionCookie,
              {},
              f.currentBindings,
            );
            expect(positive.status).toBe(200);
            const projected = await positive.json();
            if (surface === "inbox")
              expect(projected).toMatchObject({
                items: [{ title: "Confidential notification projection" }],
                unreadCount: 1,
              });
            else if (surface === "count")
              expect(projected).toEqual({ unreadCount: 1 });
            else if (surface === "preferences")
              expect(projected).toMatchObject({
                emailEnabled: true,
                emailAvailable: true,
                mutedKinds: [],
              });
            else expect(projected).toEqual({ following: true, muted: false });
            const replacement =
              mode === "captured" ? await f.replacementCookie() : null;
            let nativeReads = 0,
              fired = false;
            const db = afterNativeStatement(async (query) => {
              if (query.includes(f.nativeQuery) && ++nativeReads === 3) {
                fired = true;
                await f.invalidate(mode);
              }
            });
            const response = await callPrivate(
              path,
              f.sessionCookie,
              {},
              { ...f.currentBindings, DB: db },
            );
            expect(fired).toBe(true);
            expectPrivateDenial(response, await response.text(), 401);
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
