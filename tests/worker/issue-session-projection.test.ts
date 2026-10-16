import { env } from "cloudflare:workers";
import { afterEach, expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import {
  afterQuery,
  callPrivate,
  cleanupPrivateFixtures,
  expectPrivateDenial,
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

for (const route of ["edit", "accept", "return"] as const)
  contractWith(
    it,
    "BASE-ACCESS-002 ISSUE-004 INTAKE-006",
    `stale ${route} projection denies native signout between final native auth and the shared admission statement`,
    async () => {
      const f = await privateFixture();
      let issue = f.issue;
      if (route !== "edit") {
        const intake = await f.call("/intake", "POST", {
          title: "Confidential intake projection",
          teamId: f.initial.teams[0].id,
        });
        expect(intake.status).toBe(201);
        issue = (await intake.json()) as typeof issue;
        if (route === "return")
          expect(
            (
              await f.call(`/issues/${issue.identifier}/defer`, "POST", {
                expectedVersion: issue.version,
                returnAt: new Date(Date.now() + 3600_000).toISOString(),
              })
            ).status,
          ).toBe(200);
      }
      let projected = false,
        fired = false;
      const before = await privateState();
      const db = afterQuery(async (query, method) => {
        if (
          method === "all" &&
          query.includes("SELECT id,actor_name FROM issue_activity")
        )
          projected = true;
        if (
          projected &&
          !fired &&
          query.includes(
            "SELECT o.id,o.name,o.email,o.workspace_id AS workspaceId",
          )
        ) {
          fired = true;
          await f.change("signout");
        }
      });
      const response = await callPrivate(
        `/issues/${issue.identifier}${route === "edit" ? "" : `/${route}`}`,
        f.bobCookie,
        {
          method: route === "edit" ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedVersion: 1000,
            ...(route === "edit" ? { title: "Rejected stale change" } : {}),
          }),
        },
        { DB: db },
      );
      expect(projected).toBe(true);
      expect(fired).toBe(true);
      expectPrivateDenial(response, await response.text(), 401);
      expect(await privateState()).toEqual(before);
    },
  );
