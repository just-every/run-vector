import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { setupAdministration } from "./administration-fixture";
import { invite, actor, request } from "./base-auth-fixture";
import { retainedData } from "./removal-fixture";
import { createUlid } from "../../src/core/shared/ids";

it("[OPS-004 BASE-DATA-001] a failed cascade rolls back removal, revocation and all transfers", async () => {
  const f = await setupAdministration();
  const cookie = await invite("target@rollback.test", f.cookie);
  const target = await actor(cookie);
  const issue = await f.create({ assigneeOperatorId: target });
  const project = createUlid(new Date()),
    at = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO projects(id,workspace_id,name,lead_operator_id,lifecycle,created_at,updated_at) SELECT ?,workspace_id,'Transfer fixture',?,'active',?,? FROM operators WHERE id=?",
  )
    .bind(project, target, at, at, target)
    .run();
  const before = await retainedData();
  const nativeBefore = await env.DB.prepare(
    "SELECT a.status,a.version,s.revoked_at FROM oa_operators a JOIN vector_auth_operators m ON m.auth_id=a.id JOIN oa_sessions s ON s.operator_id=a.id WHERE m.operator_id=?",
  )
    .bind(target)
    .all();
  await env.DB.exec(
    "CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON audit_records WHEN NEW.action='operator.removed' BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END;",
  );
  try {
    const failed = await f.call(`/settings/operators/${target}`, "DELETE");
    expect(failed.status).toBe(500);
    expect(await retainedData()).toEqual(before);
    expect(
      await env.DB.prepare("SELECT removed_at FROM operators WHERE id=?")
        .bind(target)
        .first("removed_at"),
    ).toBeNull();
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM operator_removals").first(
        "n",
      ),
    ).toBe(0);
    expect(
      (
        await env.DB.prepare(
          "SELECT a.status,a.version,s.revoked_at FROM oa_operators a JOIN vector_auth_operators m ON m.auth_id=a.id JOIN oa_sessions s ON s.operator_id=a.id WHERE m.operator_id=?",
        )
          .bind(target)
          .all()
      ).results,
    ).toEqual(nativeBefore.results);
    expect(await actor(cookie)).toBe(target);
  } finally {
    await env.DB.exec("DROP TRIGGER synthetic_audit_failure");
  }
  expect((await f.call(`/settings/operators/${target}`, "DELETE")).status).toBe(
    200,
  );
  expect((await request("/api/session", "GET", undefined, cookie)).status).toBe(
    401,
  );
  expect(
    await env.DB.prepare("SELECT assignee_operator_id FROM issues WHERE id=?")
      .bind(issue.id)
      .first("assignee_operator_id"),
  ).toBeNull();
  expect(
    await env.DB.prepare("SELECT lead_operator_id FROM projects WHERE id=?")
      .bind(project)
      .first("lead_operator_id"),
  ).toBe(f.owner);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM issue_activity WHERE issue_id=? AND kind='issue.operator_removed'",
    )
      .bind(issue.id)
      .first("n"),
  ).toBe(1);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM project_activity WHERE project_id=? AND kind='project.lead_transferred'",
    )
      .bind(project)
      .first("n"),
  ).toBe(1);
});
