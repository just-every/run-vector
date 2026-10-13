import { env } from "cloudflare:workers";
import { afterEach, expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import {
  afterQuery,
  cleanupPrivateFixtures,
  callPrivate,
  expectPrivateDenial,
  observedBucket,
  privateFixture,
  privateState,
} from "./discussion-projection-fixture";

afterEach(async () => {
  await cleanupPrivateFixtures();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM access_rate_limits"),
    env.DB.prepare("DELETE FROM oa_limits"),
  ]);
});

for (const resource of ["discussion", "file"] as const)
  for (const phase of ["projection", "final-native-auth"] as const)
    contractWith(
      it,
      "BASE-ACCESS-002 BASE-ACCESS-004 OPS-004 ISSUE-008 ISSUE-009",
      `${resource} hides private projection for each invalidated native session at ${phase}`,
      async () => {
        for (const mode of [
          "remove",
          "signout",
          "expire",
          "workspace",
        ] as const) {
          try {
            const f = await privateFixture();
            expect(
              f.bobCookie.startsWith("operator_session_local_15920="),
            ).toBe(true);
            let projected = false,
              fired = false,
              finalAuthenticated = false,
              finalNativeReads = 0;
            let before: Awaited<ReturnType<typeof privateState>> | undefined;
            const race = async () => {
              if (fired) return;
              fired = true;
              await f.change(mode);
              before = await privateState();
            };
            const projectedRead = async () => {
              projected = true;
              if (phase === "projection") await race();
            };
            const db = afterQuery(async (query, method) => {
              if (
                resource === "discussion" &&
                method === "all" &&
                query.includes("FROM issue_comments c")
              )
                await projectedRead();
              if (
                projected &&
                query.includes(
                  "SELECT o.id,o.name,o.email FROM vector_auth_operators m",
                )
              ) {
                finalNativeReads++;
                // The route reauthorizes once after projection; the second read
                // is the outer API's final native identity read after its response.
                if (phase === "final-native-auth" && finalNativeReads === 2) {
                  finalAuthenticated = true;
                  await race();
                }
              }
            });
            const observed = observedBucket(projectedRead);
            const objects = (await env.FILES.list()).objects;
            const path = `/issues/${f.issue.identifier}/${resource === "discussion" ? "discussion" : `files/${f.file.id}`}`;
            const response = await callPrivate(
              path,
              f.bobCookie,
              {},
              { DB: db, FILES: observed.bucket },
            );
            expect(projected).toBe(true);
            expect(fired).toBe(true);
            if (phase === "final-native-auth")
              expect(finalAuthenticated).toBe(true);
            expectPrivateDenial(
              response,
              await response.text(),
              mode === "workspace" ? 404 : 401,
            );
            expect(await privateState()).toEqual(before);
            expect(observed.calls).toEqual({
              get: resource === "file" ? 1 : 0,
              put: 0,
              delete: 0,
            });
            expect((await env.FILES.list()).objects).toEqual(objects);
            const peer = await callPrivate(path, f.cookie);
            expect(peer.status).toBe(200);
            expect(await peer.text()).toContain(
              resource === "discussion"
                ? "Confidential comment body"
                : "Confidential stored R2 bytes",
            );
            expect(
              (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
            ).toEqual([]);
          } finally {
            await cleanupPrivateFixtures();
            await env.DB.batch([
              env.DB.prepare("DELETE FROM access_rate_limits"),
              env.DB.prepare("DELETE FROM oa_limits"),
            ]);
          }
        }
      },
    );

for (const resource of ["discussion", "file"] as const)
  contractWith(
    it,
    "BASE-ACCESS-002 BASE-ACCESS-004 ISSUE-008 ISSUE-009",
    `${resource} denies foreign-workspace admission before projection or R2 access`,
    async () => {
      const f = await privateFixture();
      await f.change("workspace");
      const before = await privateState();
      let projections = 0;
      const db = afterQuery(async (query) => {
        if (query.includes("FROM issue_comments c")) projections++;
      });
      const observed = observedBucket();
      const response = await callPrivate(
        `/issues/${f.issue.identifier}/${resource === "discussion" ? "discussion" : `files/${f.file.id}`}`,
        f.bobCookie,
        {},
        { DB: db, FILES: observed.bucket },
      );
      expectPrivateDenial(response, await response.text(), 404);
      expect(projections).toBe(0);
      expect(observed.calls).toEqual({ get: 0, put: 0, delete: 0 });
      expect(await privateState()).toEqual(before);
    },
  );
