import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import {
  app,
  bindings,
  fixture,
  heldBody,
  origin,
  retainedData,
} from "./removal-fixture";
beforeAll(async () => applyD1Migrations(env.DB, inject("migrations")));
const fileHeaders = (cookie: string) => ({
  cookie,
  origin,
  "content-type": "text/plain",
  "x-file-name": "retained.txt",
});
function holdEffect(kind: "put" | "delete") {
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => (entered = resolve)),
    hold = new Promise<void>((resolve) => (release = resolve));
  const bucket = new Proxy(env.FILES, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === kind)
        return async (...args: any[]) => {
          entered();
          await hold;
          return (value as Function).apply(target, args);
        };
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { bucket, started, release };
}
it("[OPS-004 BASE-DATA-003] a body-delayed upload is denied after removal before any reservation or R2 effect", async () => {
  const f = await fixture(),
    held = heldBody();
  let puts = 0;
  const bucket = new Proxy(env.FILES, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === "put")
        return (...args: any[]) => {
          puts++;
          return (value as Function).apply(target, args);
        };
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const pending = app.request(
    origin + "/api/issues/" + f.issue.identifier + "/files",
    { method: "POST", headers: fileHeaders(f.memberCookie), body: held.body },
    { ...bindings, FILES: bucket },
  );
  await held.reading;
  expect((await f.remove()).status).toBe(200);
  const before = await retainedData();
  const objects = await env.FILES.list();
  held.release("Bytes delivered after revocation");
  expect((await pending).status).toBe(401);
  expect(puts).toBe(0);
  expect(await retainedData()).toEqual(before);
  expect((await env.FILES.list()).objects).toEqual(objects.objects);
}, 20000);
it("[OPS-004 BASE-DATA-003] removal cannot finish across an authorized R2 upload; after settlement it anonymizes retained content", async () => {
  const f = await fixture(),
    effect = holdEffect("put");
  const pending = app.request(
    origin + "/api/issues/" + f.issue.identifier + "/files",
    {
      method: "POST",
      headers: fileHeaders(f.memberCookie),
      body: "Durable private bytes",
    },
    { ...bindings, FILES: effect.bucket },
  );
  await effect.started;
  try {
    const denied = await f.remove();
    expect(denied.status).toBe(409);
    expect(((await denied.json()) as any).error).toBe("operator_files_pending");
    expect(
      (await env.DB.prepare("SELECT removed_at FROM operators WHERE id=?")
        .bind(f.member)
        .first())!.removed_at,
    ).toBeNull();
  } finally {
    effect.release();
  }
  const uploaded = await pending;
  expect(uploaded.status).toBe(201);
  const id = ((await uploaded.json()) as any).id;
  expect((await f.remove()).status).toBe(200);
  const download = await f.request(
    "/issues/" + f.issue.identifier + "/files/" + id,
  );
  expect(await download.text()).toBe("Durable private bytes");
  expect(
    (await env.DB.prepare(
      "SELECT count(*) AS n FROM issue_activity WHERE actor_operator_id=?",
    )
      .bind(f.member)
      .first())!.n,
  ).toBe(0);
}, 20000);
it("[OPS-004 BASE-DATA-003] removal cannot finish across a committed R2 deletion; cleanup and history settle exactly once", async () => {
  const f = await fixture();
  const uploaded = await app.request(
    origin + "/api/issues/" + f.issue.identifier + "/files",
    {
      method: "POST",
      headers: fileHeaders(f.ownerCookie),
      body: "Erase these bytes",
    },
    bindings,
  );
  expect(uploaded.status).toBe(201);
  const id = ((await uploaded.json()) as any).id;
  const row = (await env.DB.prepare(
    "SELECT blob_key FROM issue_files WHERE id=?",
  )
    .bind(id)
    .first<{ blob_key: string }>())!;
  const effect = holdEffect("delete");
  const pending = f.request(
    "/issues/" + f.issue.identifier + "/files/" + id,
    "DELETE",
    undefined,
    f.memberCookie,
    { ...bindings, FILES: effect.bucket },
  );
  await effect.started;
  try {
    expect((await f.remove()).status).toBe(409);
  } finally {
    effect.release();
  }
  expect((await pending).status).toBe(200);
  expect(await env.FILES.get(row.blob_key)).toBeNull();
  expect((await f.remove()).status).toBe(200);
  expect(
    (await env.DB.prepare(
      "SELECT count(*) AS n FROM issue_activity WHERE kind='file.deleted' AND json_extract(next_value_json,'$.id')=? AND actor_operator_id IS NULL",
    )
      .bind(id)
      .first())!.n,
  ).toBe(1);
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
}, 20000);

it("[OPS-004 BASE-DATA-003] revocation immediately before file-removal intent leaves the private blob and every record intact", async () => {
  const f = await fixture();
  const uploaded = await app.request(
    origin + "/api/issues/" + f.issue.identifier + "/files",
    {
      method: "POST",
      headers: fileHeaders(f.ownerCookie),
      body: "Retain these bytes",
    },
    bindings,
  );
  expect(uploaded.status).toBe(201);
  const id = ((await uploaded.json()) as any).id;
  const key = (await env.DB.prepare(
    "SELECT blob_key FROM issue_files WHERE id=?",
  )
    .bind(id)
    .first<{ blob_key: string }>())!.blob_key;
  let deletes = 0,
    before: unknown;
  const bucket = new Proxy(env.FILES, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === "delete")
        return (...args: any[]) => {
          deletes++;
          return (value as Function).apply(target, args);
        };
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const { beforeCommit } = await import("./removal-interleaving");
  const db = beforeCommit(
    (sql) => sql.includes("UPDATE issue_files SET"),
    async () => {
      expect((await f.remove()).status).toBe(200);
      before = await retainedData();
    },
  );
  const response = await f.request(
    "/issues/" + f.issue.identifier + "/files/" + id,
    "DELETE",
    undefined,
    f.memberCookie,
    { ...bindings, DB: db, FILES: bucket },
  );
  expect(before).toBeDefined();
  expect(response.status).toBe(401);
  expect(deletes).toBe(0);
  expect(await retainedData()).toEqual(before);
  expect(await (await env.FILES.get(key))!.text()).toBe("Retain these bytes");
}, 20000);

it("[OPS-004 BASE-DATA-003] an upload accepted after removal preflight prevents the removal transaction from revoking or cascading", async () => {
  const f = await fixture(),
    effect = holdEffect("put");
  const { beforeCommit } = await import("./removal-interleaving");
  let upload: Promise<Response> | undefined, before: unknown;
  const db = beforeCommit(
    (sql) => sql.includes("INSERT INTO operator_removals"),
    async () => {
      upload = app.request(
        origin + "/api/issues/" + f.issue.identifier + "/files",
        {
          method: "POST",
          headers: fileHeaders(f.memberCookie),
          body: "Accepted across preflight",
        },
        { ...bindings, FILES: effect.bucket },
      );
      await effect.started;
      before = await retainedData();
    },
  );
  try {
    const response = await f.request(
      "/settings/operators/" + f.member,
      "DELETE",
      undefined,
      f.ownerCookie,
      { ...bindings, DB: db },
    );
    expect(before).toBeDefined();
    expect(response.status).toBe(409);
    expect(((await response.json()) as any).error).toBe(
      "operator_files_pending",
    );
    expect(await retainedData()).toEqual(before);
    expect(
      (await f.request("/session", "GET", undefined, f.memberCookie)).status,
    ).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT id FROM operator_removals WHERE operator_id=?",
      )
        .bind(f.member)
        .first(),
    ).toBeNull();
  } finally {
    effect.release();
    if (upload) expect((await upload).status).toBe(201);
  }
  expect((await f.remove()).status).toBe(200);
}, 20000);
