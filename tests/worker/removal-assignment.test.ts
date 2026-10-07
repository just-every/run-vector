import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import { bindings, fixture, retainedData } from "./removal-fixture";
import { beforeCommit } from "./removal-interleaving";
import { requestMagicLink } from "../../src/core/features/auth/repository";
beforeAll(async () => applyD1Migrations(env.DB, inject("migrations")));
for (const kind of ["create", "accept", "edit"] as const)
  it(`[OPS-004 ISSUE-005] ${kind} cannot assign a member removed after option validation`, async () => {
    const f = await fixture();
    let path = "/issues",
      body: any = {
        title: "Assignment race",
        teamId: f.team,
        assigneeOperatorId: f.member,
      },
      method = "POST";
    if (kind === "accept") {
      const intake = await f.request("/intake", "POST", {
        title: "Triage assignment",
        teamId: f.team,
      });
      const issue = (await intake.json()) as any;
      path = "/issues/" + issue.identifier + "/accept";
      body = { expectedVersion: 1, assigneeOperatorId: f.member };
    }
    if (kind === "edit") {
      path = "/issues/" + f.issue.identifier;
      method = "PATCH";
      body = { expectedVersion: 1, assigneeOperatorId: f.member };
    }
    let before: unknown;
    const db = beforeCommit(
      (sql) =>
        /(?:INSERT INTO|insert into) (?:issues|"issues"|intake_decisions|"intake_decisions"|issue_activity)/.test(
          sql,
        ),
      async () => {
        expect((await f.remove()).status).toBe(200);
        before = await retainedData();
      },
    );
    const response = await f.request(path, method, body, f.ownerCookie, {
      ...bindings,
      DB: db,
    });
    expect(before).toBeDefined();
    expect(response.status).toBe(400);
    expect(await retainedData()).toEqual(before);
  }, 20000);
it("[OPS-004 BASE-ACCESS-001] a link request validated before removal cannot recreate credentials or mail after it", async () => {
  const f = await fixture();
  const db = beforeCommit(
    (sql) => sql.includes("INSERT INTO magic_links"),
    async () => {
      expect((await f.remove()).status).toBe(200);
    },
  );
  await requestMagicLink(
    db,
    f.member + "@removal.test",
    "https://vector.test",
    "/app",
  );
  expect(
    (await env.DB.prepare(
      "SELECT count(*) AS n FROM magic_links WHERE operator_id=?",
    )
      .bind(f.member)
      .first())!.n,
  ).toBe(0);
  expect(
    (await env.DB.prepare(
      "SELECT count(*) AS n FROM local_mail_outbox WHERE recipient=?",
    )
      .bind(f.member + "@removal.test")
      .first())!.n,
  ).toBe(0);
}, 20000);
