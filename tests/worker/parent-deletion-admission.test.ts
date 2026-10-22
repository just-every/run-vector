import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { setup, ids } from "./bulk-parent-fixture";
import { fixture, receipt } from "./parent-deletion-fixture";
import { beforeCommit } from "./removal-interleaving";
import { deleteRequest } from "./issue-deletion-request";
import { testCookie, testSessionFence } from "./native-fixture";
beforeAll(setup);
async function signedInCookie(operatorId: string) {
  const before = await receipt();
  const cookie = await testCookie(env.DB, operatorId);
  const fence = await testSessionFence(env.DB, cookie);
  const identity = await env.DB.prepare(
    "SELECT m.auth_id,o.workspace_id FROM vector_auth_operators m JOIN operators o ON o.id=m.operator_id WHERE o.id=?",
  ).bind(operatorId).first<{ auth_id: string; workspace_id: string }>();
  expect(await receipt()).toEqual({
    ...before,
    audit_records: [...before.audit_records, {
      id: "signin:" + fence.sessionId,
      action: "auth.signed_in",
      actor_operator_id: operatorId,
      actor_kind: "person",
      actor_reference: "auth:" + identity!.auth_id,
      subject_id: "auth:" + identity!.auth_id,
      subject_identifier: "auth:" + identity!.auth_id,
      workspace_id: identity!.workspace_id,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    }],
  });
  return cookie;
}
it("[ISSUE-010 ISSUE-006 BASE-ACCESS-001] public deletion rejects stale intent, lost native admission and late SQL failure without any erasure", async () => {
  const { parent, files } = await fixture(),
    cookie = await signedInCookie(ids.sarah),
    before = await receipt();
  expect(
    (await deleteRequest(parent.identifier, parent.version + 1, { cookie })).status,
  ).toBe(409);
  expect(await receipt()).toEqual(before);
  for (const mode of ["revoke", "expire", "remove"]) {
    const cookie = await signedInCookie(ids.maya),
      fence = await testSessionFence(env.DB, cookie);
    let preimage: unknown;
    const DB = beforeCommit(
      (sql) => sql.includes("DELETE FROM issues"),
      async () => {
        if (mode === "remove")
          await env.DB.prepare(
            "UPDATE operators SET removed_at='now' WHERE id=?",
          )
            .bind(ids.maya)
            .run();
        else
          await env.DB.prepare(
            `UPDATE oa_sessions SET ${mode === "revoke" ? "revoked_at=1" : "expires_at=1"} WHERE id=?`,
          )
            .bind(fence.sessionId)
            .run();
        preimage = await receipt();
      },
    );
    const response = await deleteRequest(parent.identifier, parent.version, {
      DB,
      cookie,
    });
    expect(response.status, await response.clone().text()).toBe(401);
    expect(await receipt()).toEqual(preimage);
  }
  const beforeSqlFailure = await receipt();
  await env.DB.exec(
    "CREATE TRIGGER refuse_parent_deletion BEFORE DELETE ON issues BEGIN SELECT RAISE(ABORT,'late deletion failure'); END;",
  );
  try {
    expect(
      (await deleteRequest(parent.identifier, parent.version, { cookie })).status,
    ).toBe(500);
    expect(await receipt()).toEqual(beforeSqlFailure);
    for (const file of files.filter((f) => f.state !== "pending"))
      expect(await (await env.FILES.get(file.key))!.text()).toBe("data");
  } finally {
    await env.DB.exec("DROP TRIGGER refuse_parent_deletion");
  }
});
it("[BASE-ACCESS-002 ISSUE-010 ISSUE-006] final version fence and transport matrix preserve all dependency custody", async () => {
  const { parent } = await fixture();
  const cookie = await signedInCookie(ids.sarah);
  let preimage: unknown;
  const DB = beforeCommit(
    (sql) => sql.includes("DELETE FROM issues"),
    async () => {
      await env.DB.prepare("UPDATE issues SET version=version+1 WHERE id=?")
        .bind(parent.id)
        .run();
      preimage = await receipt();
    },
  );
  expect(
    (await deleteRequest(parent.identifier, parent.version, { DB, cookie })).status,
  ).toBe(409);
  expect(await receipt()).toEqual(preimage);
  for (const [options, status] of [
    [{ cookie: "" }, 401],
    [{ cookie: "", authorization: "Bearer test-only" }, 401],
    [{ origin: "https://foreign.test" }, 403],
    [{ body: { expectedVersion: parent.version } }, 400],
    [{ body: { expectedVersion: 0, confirmed: true } }, 400],
  ] as const) {
    expect(
      (await deleteRequest(parent.identifier, parent.version, { cookie, ...options })).status,
    ).toBe(status);
    expect(await receipt()).toEqual(preimage);
  }
  expect((await deleteRequest("FLW-999999999", 1, { cookie })).status).toBe(404);
  expect(await receipt()).toEqual(preimage);
  const removedCookie = await signedInCookie(ids.maya);
  const beforeRemoval = await receipt();
  await env.DB.prepare("UPDATE operators SET removed_at='now' WHERE id=?")
    .bind(ids.maya)
    .run();
  expect(
    (await deleteRequest(parent.identifier, parent.version, { cookie: removedCookie })).status,
  ).toBe(401);
  expect(await receipt()).toEqual(beforeRemoval);
});
it("[ISSUE-010 BASE-ACCESS-002] held request body, workspace race and postcommit response each recheck current native authority", async () => {
  const { heldBody } = await import("./removal-fixture"),
    { createServerApp } = await import("../../src/core/app/server");
  const { parent } = await fixture(),
    cookie = await testCookie(env.DB, ids.sarah),
    fence = await testSessionFence(env.DB, cookie),
    held = heldBody();
  const pending = createServerApp().request(
    "https://vector.test/api/issues/" + parent.identifier,
    {
      method: "DELETE",
      headers: {
        origin: "https://vector.test",
        cookie,
        "content-type": "application/json",
      },
      body: held.body,
    },
    { ...env, APP_ORIGIN: "https://vector.test" },
  );
  await held.reading;
  await env.DB.prepare("UPDATE oa_sessions SET revoked_at=1 WHERE id=?")
    .bind(fence.sessionId)
    .run();
  const before = await receipt();
  held.release(
    JSON.stringify({ expectedVersion: parent.version, confirmed: true }),
  );
  expect((await pending).status).toBe(401);
  expect(await receipt()).toEqual(before);
  let beforeWorkspaceRace: unknown;
  const raced = beforeCommit(
    (sql) => sql.includes("DELETE FROM issues"),
    async () => {
      await env.DB.prepare(
        "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES('deletion-foreign','Foreign','UTC','now','now')",
      ).run();
      await env.DB.prepare(
        "UPDATE operators SET workspace_id='deletion-foreign' WHERE id=?",
      )
        .bind(ids.alex)
        .run();
      beforeWorkspaceRace = await receipt();
    },
  );
  const workspaceResponse = await deleteRequest(
    parent.identifier,
    parent.version,
    { DB: raced, actor: ids.alex },
  );
  expect(workspaceResponse.status, await workspaceResponse.clone().text()).toBe(
    404,
  );
  expect(await receipt()).toEqual(beforeWorkspaceRace);
  await env.DB.prepare(
    "UPDATE operators SET workspace_id=(SELECT workspace_id FROM operators WHERE id=?) WHERE id=?",
  )
    .bind(ids.sarah, ids.alex)
    .run();
  await env.DB.prepare(
    "DELETE FROM workspace_settings WHERE id='deletion-foreign'",
  ).run();
  const own = await testCookie(env.DB, ids.sarah),
    ownFence = await testSessionFence(env.DB, own);
  let revoked = false;
  const bucket = new Proxy(env.FILES, {
    get(target, key) {
      if (key === "delete")
        return async (name: string) => {
          if (!revoked) {
            revoked = true;
            await env.DB.prepare(
              "UPDATE oa_sessions SET revoked_at=1 WHERE id=?",
            )
              .bind(ownFence.sessionId)
              .run();
          }
          return target.delete(name);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  expect(
    (
      await deleteRequest(parent.identifier, parent.version, {
        cookie: own,
        FILES: bucket,
      })
    ).status,
  ).toBe(401);
  expect(
    await env.DB.prepare("SELECT 1 FROM issues WHERE id=?")
      .bind(parent.id)
      .first(),
  ).toBeNull();
  expect(
    await env.DB.prepare("SELECT 1 FROM issue_deletions WHERE issue_id=?")
      .bind(parent.id)
      .first(),
  ).not.toBeNull();
  const fresh = await testCookie(env.DB, ids.sarah);
  const response = await createServerApp().request(
    "https://vector.test/api/issues/" + parent.identifier + "/deletion",
    { headers: { cookie: fresh } },
    { ...env, APP_ORIGIN: "https://vector.test" },
  );
  expect(response.status).toBe(200);
  const foreign = await testCookie(env.DB, ids.alex);
  await env.DB.prepare(
    "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES('deletion-foreign','Foreign','UTC','now','now')",
  ).run();
  await env.DB.prepare(
    "UPDATE operators SET workspace_id='deletion-foreign' WHERE id=?",
  )
    .bind(ids.alex)
    .run();
  const { createApiApp } = await import("../../src/core/app/api");
  expect(
    (
      await createApiApp().request(
        "https://vector.test/issues/" + parent.identifier + "/deletion",
        { headers: { cookie: foreign } },
        { ...env, APP_ORIGIN: "https://vector.test" },
      )
    ).status,
  ).toBe(404);
});
