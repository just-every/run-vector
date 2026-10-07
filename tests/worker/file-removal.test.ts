import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import assert from "node:assert/strict";
import { beforeEach, inject, it } from "vitest";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { createUlid } from "../../src/core/shared/ids";
import {
  requestFileRemoval,
  processFileRemovals,
} from "../../src/core/features/file-removal/service";
import { createServerApp } from "../../src/core/app/server";
import { testCookie } from "./native-fixture";

const issue = { id: ids.flw842, identifier: "FLW-842" };
const fixtureFiles: { id: string; key: string }[] = [];
const migrationTitle =
  "[BASE-OPS-002] preserves prior ready files and creates recovery intent for legacy tombstones";
beforeEach(async ({ task }) => {
  // This pool retains storage within a file. Clean only this file's completed
  // fixture operations, whose writers have all been joined by their test.
  for (const file of fixtureFiles.splice(0)) {
    await env.FILES.delete(file.key);
    await env.DB.prepare("DELETE FROM issue_files WHERE id=?")
      .bind(file.id)
      .run();
  }
  const migrations = inject("migrations");
  await applyD1Migrations(
    env.DB,
    task.name === migrationTitle ? migrations.slice(0, 6) : migrations,
  );
  await ensureSampleData(env.DB, new Date());
});

async function sha256(body: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function reserve(
  body = "Original evidence",
  state = "pending",
  settled = 0,
) {
  const id = createUlid(new Date()),
    key = `issues/${issue.id}/${id}`,
    now = new Date().toISOString(),
    sha = await sha256(body);
  await env.DB.prepare(
    `INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,writer_settled,content_sha256,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      id,
      issue.id,
      ids.sarah,
      "Private identifying evidence.txt",
      "text/plain",
      new TextEncoder().encode(body).byteLength,
      key,
      state,
      settled,
      sha,
      now,
      now,
    )
    .run();
  fixtureFiles.push({ id, key });
  return { id, key, body, sha };
}
async function put(file: Awaited<ReturnType<typeof reserve>>) {
  await env.FILES.put(file.key, file.body, {
    customMetadata: { operationId: file.id, sha256: file.sha },
  });
}
function row(id: string) {
  return env.DB.prepare("SELECT * FROM issue_files WHERE id=?")
    .bind(id)
    .first<any>();
}
async function history(id: string) {
  const activity = await env.DB.prepare(
    "SELECT COUNT(*) n FROM issue_activity WHERE kind='file.deleted' AND json_extract(next_value_json,'$.id')=?",
  )
    .bind(id)
    .first<{ n: number }>();
  const audit = await env.DB.prepare(
    "SELECT COUNT(*) n FROM audit_records WHERE action='file.deleted' AND subject_id=?",
  )
    .bind(id)
    .first<{ n: number }>();
  return { activity: activity!.n, audit: audit!.n };
}
function boundProxy<T extends object>(
  target: T,
  replacement: (property: PropertyKey) => unknown,
) {
  return new Proxy(target, {
    get(item, property) {
      const changed = replacement(property);
      if (changed !== undefined) return changed;
      const value = Reflect.get(item, property);
      return typeof value === "function" ? value.bind(item) : value;
    },
  });
}

it(migrationTitle, async () => {
  const now = "2026-09-30T00:00:00.000Z",
    ready = createUlid(new Date()),
    legacy = createUlid(new Date());
  for (const [id, state, deleted] of [
    [ready, "ready", null],
    [legacy, "pending", now],
  ]) {
    await env.DB.prepare(
      `INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,deleted_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        id,
        issue.id,
        ids.sarah,
        "Historical file",
        "text/plain",
        4,
        "legacy/" + id,
        state,
        deleted,
        now,
        now,
      )
      .run();
    fixtureFiles.push({ id: id as string, key: "legacy/" + id });
  }
  await env.FILES.put("legacy/" + ready, "Keep");
  await env.FILES.put("legacy/" + legacy, "Late");
  await applyD1Migrations(env.DB, inject("migrations").slice(6));
  const prior = await row(ready);
  assert.equal(prior.name, "Historical file");
  assert.equal(prior.state, "ready");
  assert.equal(prior.writer_settled, 1);
  assert.equal(prior.removal_requested_at, null);
  assert.equal(await (await env.FILES.get(prior.blob_key))!.text(), "Keep");
  const orphan = await row(legacy);
  assert.equal(orphan.deleted_at, now);
  assert.equal(orphan.removal_requested_at, now);
  assert.equal(orphan.writer_settled, 0);
  assert.deepEqual(await processFileRemovals(env), {
    processed: 1,
    removed: 1,
    pending: 0,
    failed: 0,
  });
  const recovered = await row(legacy);
  assert.equal(recovered.deleted_at, now);
  assert.ok(recovered.removal_confirmed_at);
  assert.equal(recovered.name, "");
  assert.equal(await env.FILES.get(recovered.blob_key), null);
  assert.deepEqual(await history(legacy), { activity: 0, audit: 0 });
  assert.deepEqual(await processFileRemovals(env), {
    processed: 0,
    removed: 0,
    pending: 0,
    failed: 0,
  });
});

it("[ISSUE-009][BASE-DATA-003] pending pre-PUT removal stays unconfirmed; late original PUT is cleaned without false success", async () => {
  const file = await reserve();
  assert.equal(
    await requestFileRemoval(env, issue, file.id, ids.sarah),
    "pending",
  );
  let metadata = await row(file.id);
  assert.ok(metadata.removal_requested_at);
  assert.equal(metadata.deleted_at, null);
  assert.equal(metadata.removal_confirmed_at, null);
  assert.equal(metadata.name, "Private identifying evidence.txt");
  assert.deepEqual(await history(file.id), { activity: 0, audit: 0 });
  assert.deepEqual(await processFileRemovals(env), {
    processed: 1,
    removed: 0,
    pending: 1,
    failed: 0,
  });
  await put(file);
  assert.equal(
    await requestFileRemoval(env, issue, file.id, ids.sarah),
    "removed",
  );
  metadata = await row(file.id);
  assert.ok(metadata.removal_confirmed_at);
  assert.ok(metadata.deleted_at);
  assert.equal(metadata.writer_settled, 1);
  assert.equal(metadata.name, "");
  assert.equal(metadata.content_type, "");
  assert.equal(metadata.content_sha256, null);
  assert.equal(await env.FILES.get(file.key), null);
  assert.deepEqual(await history(file.id), { activity: 1, audit: 1 });
  assert.equal(
    await requestFileRemoval(env, issue, file.id, ids.maya),
    "removed",
  );
  assert.deepEqual(await history(file.id), { activity: 1, audit: 1 });
});

it("[ISSUE-009][BASE-OPS-005] refuses a mismatching pending object and preserves its original bytes for recovery", async () => {
  const file = await reserve();
  await env.FILES.put(file.key, file.body, {
    customMetadata: { operationId: file.id, sha256: "wrong-checksum" },
  });
  assert.equal(
    await requestFileRemoval(env, issue, file.id, ids.sarah),
    "failed",
  );
  const metadata = await row(file.id);
  assert.equal(metadata.writer_settled, 0);
  assert.equal(metadata.removal_confirmed_at, null);
  assert.ok(metadata.cleanup_error);
  assert.equal(await (await env.FILES.get(file.key))!.text(), file.body);
  assert.deepEqual(await history(file.id), { activity: 0, audit: 0 });
});

it("[ISSUE-009][BASE-OPS-005] retains retryable intent on real-object R2 erase and D1 commit failures", async () => {
  for (const failingBinding of ["R2", "D1"]) {
    const file = await reserve("Failure recovery evidence", "ready", 1);
    await put(file);
    const broken =
      failingBinding === "R2"
        ? {
            ...env,
            FILES: boundProxy(env.FILES, (property) =>
              property === "delete"
                ? async () => {
                    throw new Error("Provider secret must never escape");
                  }
                : undefined,
            ),
          }
        : {
            ...env,
            DB: boundProxy(env.DB, (property) =>
              property === "batch"
                ? async () => {
                    throw new Error("SQL secret must never escape");
                  }
                : undefined,
            ),
          };
    assert.equal(
      await requestFileRemoval(broken, issue, file.id, ids.sarah),
      "failed",
    );
    const metadata = await row(file.id);
    assert.ok(metadata.removal_requested_at);
    assert.equal(metadata.removal_confirmed_at, null);
    assert.equal(metadata.deleted_at, null);
    assert.equal(
      metadata.cleanup_error,
      "File cleanup could not complete. Retry removal.",
    );
    assert.equal(metadata.name, "Private identifying evidence.txt");
    assert.deepEqual(await history(file.id), { activity: 0, audit: 0 });
    if (failingBinding === "R2")
      assert.equal(await (await env.FILES.get(file.key))!.text(), file.body);
    else assert.equal(await env.FILES.get(file.key), null);
    assert.equal(
      await requestFileRemoval(env, issue, file.id, ids.sarah),
      "removed",
    );
    assert.ok((await row(file.id)).removal_confirmed_at);
    assert.equal(await env.FILES.get(file.key), null);
    assert.deepEqual(await history(file.id), { activity: 1, audit: 1 });
  }
});

it("[ISSUE-009][BASE-DATA-003] concurrent deletion commits one activity/audit and repeated sweep is idempotent", async () => {
  const file = await reserve("Concurrent removal", "ready", 1);
  await put(file);
  const result = await Promise.all([
    requestFileRemoval(env, issue, file.id, ids.sarah),
    requestFileRemoval(env, issue, file.id, ids.maya),
  ]);
  assert.deepEqual(result, ["removed", "removed"]);
  assert.deepEqual(await history(file.id), { activity: 1, audit: 1 });
  assert.deepEqual(await processFileRemovals(env), {
    processed: 0,
    removed: 0,
    pending: 0,
    failed: 0,
  });
  assert.equal(await env.FILES.get(file.key), null);
});

it("[ISSUE-009][BASE-INPUT-003] unresolved legacy tombstones consume quota until physical cleanup is confirmed", async () => {
  const file = await reserve("Reservation", "ready", 1);
  await env.DB.prepare(
    "UPDATE issue_files SET bytes=10737418240,deleted_at=?,removal_requested_at=? WHERE id=?",
  )
    .bind("2026-09-30T00:00:00.000Z", "2026-09-30T00:00:00.000Z", file.id)
    .run();
  const app = createServerApp(),
    origin = "https://vector.test",
    cookie = await testCookie(env.DB, ids.sarah);
  const upload = () =>
    app.request(
      origin + "/api/issues/FLW-842/files",
      {
        method: "POST",
        headers: {
          cookie,
          origin,
          "Content-Type": "text/plain",
          "X-File-Name": "New bytes",
        },
        body: "New evidence",
      },
      { ...env, APP_ORIGIN: origin },
    );
  assert.equal((await upload()).status, 413);
  assert.equal(
    await requestFileRemoval(env, issue, file.id, ids.sarah),
    "removed",
  );
  assert.equal((await upload()).status, 201);
});

it("[BASE-OPS-005] scheduled sweep is bounded and rotates unresolved rows without confirming absent pending writers", async () => {
  const rows = [];
  for (let n = 0; n < 51; n++) {
    const file = await reserve(String(n));
    rows.push(file.id);
    await env.DB.prepare(
      "UPDATE issue_files SET removal_requested_at=?,updated_at=? WHERE id=?",
    )
      .bind("2026-09-30T00:00:00.000Z", "2026-09-30T00:00:00.000Z", file.id)
      .run();
  }
  assert.deepEqual(await processFileRemovals(env), {
    processed: 50,
    removed: 0,
    pending: 50,
    failed: 0,
  });
  const untouched = await env.DB.prepare(
    "SELECT id FROM issue_files WHERE updated_at='2026-09-30T00:00:00.000Z'",
  ).all<{ id: string }>();
  assert.equal(untouched.results.length, 1);
  await processFileRemovals(env);
  assert.notEqual(
    (await row(untouched.results[0].id)).updated_at,
    "2026-09-30T00:00:00.000Z",
  );
  assert.equal(
    (await env.DB.prepare(
      "SELECT COUNT(*) n FROM issue_files WHERE removal_confirmed_at IS NOT NULL",
    ).first<{ n: number }>())!.n,
    0,
  );
});

it("[ISSUE-009][BASE-DATA-003] authenticated DELETE cannot falsely confirm an in-flight native upload", async () => {
  const app = createServerApp(),
    origin = "https://vector.test",
    cookie = await testCookie(env.DB, ids.sarah);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const delayedFiles = boundProxy(env.FILES, (property) =>
    property === "put"
      ? async (...args: Parameters<R2Bucket["put"]>) => {
          entered();
          await gate;
          return env.FILES.put(...args);
        }
      : undefined,
  );
  const uploading = app.request(
    origin + "/api/issues/FLW-842/files",
    {
      method: "POST",
      headers: {
        cookie,
        origin,
        "Content-Type": "text/plain",
        "X-File-Name": "Racing native upload",
      },
      body: "Late original bytes",
    },
    { ...env, FILES: delayedFiles, APP_ORIGIN: origin },
  );
  await started;
  const pending = await env.DB.prepare(
    "SELECT id,blob_key FROM issue_files WHERE name='Racing native upload' AND deleted_at IS NULL",
  ).first<{ id: string; blob_key: string }>();
  assert.ok(pending);
  fixtureFiles.push({ id: pending.id, key: pending.blob_key });
  const path = origin + "/api/issues/FLW-842/files/" + pending.id;
  try {
    const removing = await app.request(
      path,
      { method: "DELETE", headers: { cookie, origin } },
      { ...env, APP_ORIGIN: origin },
    );
    assert.equal(removing.status, 202);
    assert.equal(((await removing.json()) as any).removed, false);
    assert.equal((await row(pending.id)).removal_confirmed_at, null);
    assert.deepEqual(await history(pending.id), { activity: 0, audit: 0 });
  } finally {
    release();
  }
  const uploaded = await uploading;
  assert.equal(uploaded.status, 409);
  assert.equal(((await uploaded.json()) as any).error, "upload_cancelled");
  assert.ok((await row(pending.id)).removal_confirmed_at);
  assert.equal(await env.FILES.get(pending.blob_key), null);
  assert.equal(
    (
      await app.request(
        path,
        { headers: { cookie } },
        { ...env, APP_ORIGIN: origin },
      )
    ).status,
    404,
  );
  assert.deepEqual(await history(pending.id), { activity: 1, audit: 1 });
  const created = await env.DB.prepare(
    "SELECT COUNT(*) n FROM issue_activity WHERE kind='file.created' AND json_extract(next_value_json,'$.id')=?",
  )
    .bind(pending.id)
    .first<{ n: number }>();
  assert.equal(created!.n, 0);
});
