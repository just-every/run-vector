import { env } from "cloudflare:workers";
import assert from "node:assert/strict";
import { beforeAll, it } from "vitest";
import { createIssue, request, setup } from "./search-mutation-receipts-fixture";
import { decisionBody, intake, retained } from "./browse-mutation-fixture";

beforeAll(setup);

for (const kind of ["accept", "defer", "decline", "return", "return-noop", "edit-noop", "timezone"] as const)
  it(`[ISSUE-006 INTAKE-006 OPS-003 VIEW-001] ${kind} rolls back source, history and browsing revision on a native statement failure`, async () => {
    const issue = kind === "edit-noop" ? await createIssue({ title: "Rollback no-op" }) : await intake();
    let path = `/issues/${issue.identifier}/${kind}`, method = "POST", body: unknown = decisionBody(kind);
    if (kind === "return") {
      assert.equal((await request(`/issues/${issue.identifier}/defer`, "POST", decisionBody("defer"))).status, 200);
      body = { expectedVersion: 2 };
    } else if (kind === "return-noop") {
      path = `/issues/${issue.identifier}/return`;
    } else if (kind === "edit-noop") {
      path = `/issues/${issue.identifier}`;
      method = "PATCH";
      body = { expectedVersion: 1, title: "Rollback no-op" };
    } else if (kind === "timezone") {
      path = "/settings";
      method = "PATCH";
      body = { timezone: "Europe/Paris" };
    }
    const before = await retained();
    await env.DB.exec(`CREATE TRIGGER reject_browse_mutation AFTER UPDATE ON ${kind === "timezone" ? "workspace_settings" : "issues"} BEGIN SELECT RAISE(ABORT,'native mutation fault'); END`);
    try {
      assert.equal((await request(path, method, body)).status, 500);
      assert.deepEqual(await retained(), before, "the same transaction rolls back revision, event and mutation");
    } finally {
      await env.DB.exec("DROP TRIGGER reject_browse_mutation");
    }
    assert.equal((await request(path, method, body)).status, 200, "the unchanged command succeeds after storage recovers");
  });
