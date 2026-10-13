import { createServerApp } from "../../src/core/app/server";
import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { setup, create, ids } from "./bulk-parent-fixture";
import { fixture } from "./parent-deletion-fixture";
import { deleteRequest } from "./issue-deletion-request";
import { call } from "./bulk-parent-fixture";
import {
  addComment,
  addFile,
  finalizeFile,
} from "../../src/core/features/discussion/repository";
import {
  processFileRemovals,
  requestFileRemoval,
} from "../../src/core/features/file-removal/service";
import { createUlid } from "../../src/core/shared/ids";
import { testCookie } from "./native-fixture";
import { hasPendingOperatorFiles } from "../../src/core/features/settings/removal-files";
beforeAll(setup);
it("[ISSUE-010 REL-006 BASE-OPS-002] commented parent deletion preserves descendants and durable ready/deleted/inflight cleanup until real settlement", async () => {
  const { parent, child, grandchild, files } = await fixture();
  const download = await call(
    `/issues/${parent.identifier}/files/${files[0].id}`,
  );
  expect(download.status).toBe(200);
  expect(await download.text()).toBe("data");
  const searchPath = "/search?q=" + encodeURIComponent(parent.identifier),
    listPath = "/issues?q=" + encodeURIComponent(parent.identifier);
  expect(
    ((await (await call(searchPath)).json()) as any).issues.map(
      (row: any) => row.identifier,
    ),
  ).toContain(parent.identifier);
  expect(
    ((await (await call(listPath)).json()) as any).issues.map(
      (row: any) => row.identifier,
    ),
  ).toContain(parent.identifier);
  const failed = new Proxy(env.FILES, {
    get(target, key) {
      if (key === "delete")
        return async () => {
          throw Error("injected R2 failure");
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  for (const file of files.filter((f) => f.state !== "pending"))
    expect(await (await env.FILES.get(file.key))!.text()).toBe("data");
  const deleted = await deleteRequest(parent.identifier, parent.version, {
    FILES: failed,
  });
  expect(deleted.status, await deleted.clone().text()).toBe(202);
  expect(await deleted.json()).toMatchObject({
    cleanup: "failed",
    files: 3,
    removed: 0,
  });
  expect(
    (await call(`/issues/${parent.identifier}/files/${files[0].id}`)).status,
  ).toBe(404);
  expect(((await (await call(searchPath)).json()) as any).issues).toEqual([]);
  expect(((await (await call(listPath)).json()) as any).issues).toEqual([]);

  for (const table of ["issues", "search_issues"])
    expect(
      await env.DB.prepare(`SELECT 1 FROM ${table} WHERE id=?`)
        .bind(parent.id)
        .first(),
    ).toBeNull();
  for (const table of ["issue_comments", "issue_links", "issue_files"])
    expect(
      await env.DB.prepare(`SELECT 1 FROM ${table} WHERE issue_id=?`)
        .bind(parent.id)
        .first(),
    ).toBeNull();
  expect(
    await env.DB.prepare(
      "SELECT parent_issue_id FROM issue_parents WHERE issue_id=?",
    )
      .bind(child.id)
      .first(),
  ).toBeNull();
  expect(
    await env.DB.prepare(
      "SELECT parent_issue_id FROM issue_parents WHERE issue_id=?",
    )
      .bind(grandchild.id)
      .first("parent_issue_id"),
  ).toBe(child.id);
  expect(
    await env.DB.prepare("SELECT version FROM issues WHERE id=?")
      .bind(child.id)
      .first("version"),
  ).toBe(child.version + 2);
  expect(
    await env.DB.prepare("SELECT identifier FROM issues WHERE id=?")
      .bind(child.id)
      .first("identifier"),
  ).toBe(child.identifier);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM issue_activity WHERE issue_id=? AND kind='issue.parent_changed'",
    )
      .bind(child.id)
      .first("n"),
  ).toBe(2);
  expect(
    (await processFileRemovals({ ...env, FILES: failed })).failed,
  ).toBeGreaterThanOrEqual(2);
  expect(
    await env.DB.prepare(
      "SELECT SUM(bytes) n FROM detached_file_removals WHERE issue_id=? AND removal_confirmed_at IS NULL",
    )
      .bind(parent.id)
      .first("n"),
  ).toBe(12);
  expect(await hasPendingOperatorFiles(env.DB, ids.sarah)).toBe(true);
  const quotaFile = files[0];
  await env.DB.prepare(
    "UPDATE detached_file_removals SET bytes=10737418240 WHERE id=?",
  )
    .bind(quotaFile.id)
    .run();
  const deniedId = createUlid(new Date());
  expect(
    await addFile(env.DB, child, ids.sarah, {
      id: deniedId,
      key: `quota/${deniedId}`,
      name: "Over quota",
      contentType: "text/plain",
      bytes: 1,
      sha256: "x",
    }),
  ).toBe(false);
  expect(
    await env.DB.prepare("SELECT 1 FROM issue_files WHERE id=?")
      .bind(deniedId)
      .first(),
  ).toBeNull();
  await env.DB.prepare("UPDATE detached_file_removals SET bytes=4 WHERE id=?")
    .bind(quotaFile.id)
    .run();
  await processFileRemovals(env);
  const pending = files.find((f) => f.state === "pending")!;
  expect(
    await env.DB.prepare(
      "SELECT writer_settled FROM detached_file_removals WHERE id=?",
    )
      .bind(pending.id)
      .first("writer_settled"),
  ).toBe(0);
  expect(
    await env.DB.prepare(
      "SELECT SUM(bytes) n FROM detached_file_removals WHERE issue_id=? AND removal_confirmed_at IS NULL",
    )
      .bind(parent.id)
      .first("n"),
  ).toBe(4);
  await env.FILES.put(pending.key, "data", {
    customMetadata: { operationId: pending.id, sha256: "checksum" },
  });
  expect(await finalizeFile(env.DB, parent.id, pending.id, ids.sarah)).toBe(
    false,
  );
  await processFileRemovals(env);
  for (const file of files) {
    expect(await env.FILES.head(file.key)).toBeNull();
    expect(
      await env.DB.prepare(
        "SELECT removal_confirmed_at FROM detached_file_removals WHERE id=?",
      )
        .bind(file.id)
        .first("removal_confirmed_at"),
    ).toBeTruthy();
  }
});
it("[BASE-OPS-002 ISSUE-010] cleanup in flight retains custody when parent deletion races the R2 head", async () => {
  const { parent, files } = await fixture();
  const pending = files.find((f) => f.state === "pending")!;
  await env.FILES.put(pending.key, "data", {
    customMetadata: { operationId: pending.id, sha256: "checksum" },
  });
  let deleted = false;
  const bucket = new Proxy(env.FILES, {
    get(target, key) {
      if (key === "head")
        return async (k: string) => {
          const object = await target.head(k);
          if (!deleted) {
            deleted = true;
            const response = await deleteRequest(
              parent.identifier,
              parent.version,
            );
            expect(response.status, await response.clone().text()).toBe(200);
          }
          return object;
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  expect(
    await requestFileRemoval(
      { ...env, FILES: bucket },
      parent,
      pending.id,
      ids.sarah,
    ),
  ).toBe("removed");
  expect(
    await env.DB.prepare(
      "SELECT removal_confirmed_at FROM detached_file_removals WHERE id=?",
    )
      .bind(pending.id)
      .first("removal_confirmed_at"),
  ).toBeTruthy();
  await processFileRemovals(env);
});
it("[ISSUE-010 BASE-OPS-002] actual admitted upload finishes after parent deletion and settles its detached reservation", async () => {
  const parent = await create();
  await addComment(env.DB, parent.id, ids.sarah, "Upload race comment");
  const cookie = await testCookie(env.DB, ids.sarah);
  let keyWritten = "";
  const bucket = new Proxy(env.FILES, {
    get(target, key) {
      if (key === "put")
        return async (key: string, value: any, options: any) => {
          keyWritten = key;
          expect(
            (await deleteRequest(parent.identifier, parent.version)).status,
          ).toBe(202);
          return target.put(key, value, options);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const origin = "https://vector.test";
  const response = await createServerApp().request(
    `${origin}/api/issues/${parent.identifier}/files`,
    {
      method: "POST",
      headers: {
        origin,
        cookie,
        "content-type": "text/plain",
        "x-file-name": "Original.txt",
      },
      body: "Late original upload",
    },
    { ...env, FILES: bucket, APP_ORIGIN: origin },
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: "upload_cancelled" });
  expect(await env.FILES.head(keyWritten)).toBeNull();
  expect(
    await env.DB.prepare(
      "SELECT removal_confirmed_at FROM detached_file_removals WHERE blob_key=?",
    )
      .bind(keyWritten)
      .first("removal_confirmed_at"),
  ).toBeTruthy();
  const missingConfirmation = await createServerApp().request(
    `${origin}/api/issues/${parent.identifier}`,
    { method: "DELETE", headers: { origin, cookie } },
    { ...env, APP_ORIGIN: origin },
  );
  expect(missingConfirmation.status).toBe(400);
  expect(
    await (await call(`/issues/${parent.identifier}/deletion`)).json(),
  ).toMatchObject({ cleanup: "complete" });
});
