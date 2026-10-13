import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import assert from "node:assert/strict";
import { beforeAll, inject, it } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { testCookie } from "./native-fixture";
import { updateIssueRecord } from "../../src/core/features/issue-edit/repository";
import { createUlid } from "../../src/core/shared/ids";
const app = createServerApp(),
  origin = "https://vector.test";
const bindings = { ...env, APP_ORIGIN: origin, MAIL_MODE: "production" };
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date());
});
async function request(path: string, method = "GET", body?: unknown) {
  return app.request(
    origin + path,
    {
      method,
      headers: {
        cookie: await testCookie(env.DB, ids.sarah),
        origin,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    bindings,
  );
}
async function issue(title: string) {
  const response = await request("/api/issues", "POST", {
    title,
    teamId: ids.flow,
    assigneeOperatorId: ids.sarah,
  });
  assert.equal(response.status, 201);
  return (await response.json()) as any;
}
it("[ISSUE-004][ISSUE-006] semantic no-op preserves version/activity but rejects a real write between read and its guarded no-op write", async () => {
  const created = await issue("No-op concurrency");
  const path = "/api/issues/" + created.identifier;
  const unchanged = await request(path, "PATCH", {
    expectedVersion: 1,
    title: created.title,
  });
  assert.equal(unchanged.status, 200);
  const before = (await unchanged.json()) as any;
  assert.equal(before.version, 1);
  assert.equal(
    before.activity.filter((a: any) => a.kind === "issue.updated").length,
    0,
  );
  let intervened = false;
  // Real D1 statements, with one deterministic interleaving before the guarded
  // no-op write. Retained historical choices skip option revalidation. The
  // intervening writer still goes through the real authenticated API.
  function statement(
    target: D1PreparedStatement,
    query: string,
  ): D1PreparedStatement {
    return new Proxy(target, {
      get(item, key) {
        if (key === "bind")
          return (...args: unknown[]) => statement(item.bind(...args), query);
        if (key === "run")
          return async (...args: any[]) => {
            if (
              !intervened &&
              query.includes("UPDATE issues SET version=version")
            ) {
              intervened = true;
              const concurrent = await request(path, "PATCH", {
                expectedVersion: 1,
                title: "Concurrent committed edit",
              });
              assert.equal(concurrent.status, 200);
            }
            return item.run(...args);
          };
        const value = Reflect.get(item, key);
        return typeof value === "function" ? value.bind(item) : value;
      },
    });
  }
  const interleaved = new Proxy(env.DB, {
    get(target, key) {
      if (key === "prepare")
        return (query: string) => statement(target.prepare(query), query);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  assert.equal(
    await updateIssueRecord(interleaved, created.identifier, ids.sarah, {
      expectedVersion: 1,
      title: created.title,
      assigneeOperatorId: ids.sarah,
    }),
    "stale",
  );
  assert.ok(intervened);
  const after = (await (await request(path)).json()) as any;
  assert.equal(after.title, "Concurrent committed edit");
  assert.equal(after.version, 2);
  assert.equal(
    after.activity.filter((a: any) => a.kind === "issue.updated").length,
    1,
  );
});
it("[ISSUE-009][BASE-INPUT-003][BASE-OPS-005] failed R2 handoff retains visible recovery, original bytes and conservative quota until removal", async () => {
  const created = await issue("Upload recovery"),
    path = "/api/issues/" + created.identifier;
  const cookie = await testCookie(env.DB, ids.sarah);
  const headers = {
    cookie,
    origin,
    "Content-Type": "text/plain",
    "X-File-Name": encodeURIComponent("日本語's evidence.txt"),
    "X-File-Name-Encoding": "uri",
  };
  const faultFiles = new Proxy(env.FILES, {
    get(target, key) {
      if (key === "put")
        return async (...args: any[]) => {
          await (target.put as any)(...args);
          throw new Error("Synthetic failure after persisted R2 write");
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const failed = await app.request(
    origin + path + "/files",
    { method: "POST", headers, body: "Recovery evidence" },
    { ...bindings, FILES: faultFiles },
  );
  assert.equal(failed.status, 503);
  assert.equal(((await failed.json()) as any).error, "file_upload_failed");
  const discussion = (await (
    await request(path + "/discussion")
  ).json()) as any;
  assert.equal(discussion.files[0].state, "failed");
  assert.equal(discussion.files[0].name, "日本語's evidence.txt");
  const fileId = discussion.files[0].id;
  const metadata = await env.DB.prepare(
    "SELECT blob_key FROM issue_files WHERE id=?",
  )
    .bind(fileId)
    .first<{ blob_key: string }>();
  assert.equal(
    await (await env.FILES.get(metadata!.blob_key))!.text(),
    "Recovery evidence",
  );
  assert.equal((await request(path + "/files/" + fileId)).status, 503);
  assert.equal(
    (await request(path + "/files/" + fileId, "DELETE")).status,
    200,
  );
  assert.equal(await env.FILES.get(metadata!.blob_key), null);
  const now = new Date().toISOString(),
    reservation = createUlid(new Date());
  await env.DB.prepare(
    "INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'failed',?,?)",
  )
    .bind(
      reservation,
      created.id,
      ids.sarah,
      "Prior failed handoff",
      "text/plain",
      10737418240,
      "recovery/" + reservation,
      now,
      now,
    )
    .run();
  const upload = () =>
    app.request(
      origin + path + "/files",
      { method: "POST", headers, body: "Retried evidence" },
      bindings,
    );
  assert.equal((await upload()).status, 413);
  assert.equal(
    (await request(path + "/files/" + reservation, "DELETE")).status,
    200,
  );
  const retried = await upload();
  assert.equal(retried.status, 201);
  const retriedFile = (await retried.json()) as any;
  const download = await request(path + "/files/" + retriedFile.id);
  assert.equal(await download.text(), "Retried evidence");
  assert.match(download.headers.get("content-disposition")!, /%E6%97%A5/);
  assert.match(download.headers.get("content-disposition")!, /%27s/);
  assert.equal(
    (
      await app.request(
        origin + path + "/files",
        {
          method: "POST",
          headers: { ...headers, "X-File-Name": "%ZZ" },
          body: "bad encoding",
        },
        bindings,
      )
    ).status,
    400,
  );
});
