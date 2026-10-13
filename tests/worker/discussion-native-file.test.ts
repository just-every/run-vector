import { env } from "cloudflare:workers";
import { afterEach, expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { beforeCommit } from "./removal-interleaving";
import {
  callPrivate,
  cleanupPrivateFixtures,
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

for (const method of ["POST", "DELETE"] as const)
  contractWith(
    it,
    "BASE-ACCESS-002 BASE-ACCESS-004 OPS-004 ISSUE-009",
    `native invalidation before ${method} file intent denies every record and R2 effect`,
    async () => {
      for (const mode of ["remove", "signout", "expire"] as const) {
        try {
          const f = await privateFixture();
          let before: Awaited<ReturnType<typeof privateState>> | undefined;
          const db = beforeCommit(
            (query) =>
              query.includes(
                method === "POST"
                  ? "INSERT INTO issue_files"
                  : "UPDATE issue_files SET",
              ),
            async () => {
              await f.change(mode);
              before = await privateState();
            },
          );
          const observed = observedBucket();
          const objects = (await env.FILES.list()).objects;
          const response = await callPrivate(
            `/issues/${f.issue.identifier}/files${method === "DELETE" ? `/${f.file.id}` : ""}`,
            f.bobCookie,
            {
              method,
              headers: {
                "content-type": "text/plain",
                "x-file-name": "Rejected.txt",
              },
              ...(method === "POST" ? { body: "Rejected bytes" } : {}),
            },
            { DB: db, FILES: observed.bucket },
          );
          expect(before).toBeDefined();
          expectPrivateDenial(response, await response.text(), 401);
          expect(await privateState()).toEqual(before);
          expect(observed.calls).toEqual({ get: 0, put: 0, delete: 0 });
          expect((await env.FILES.list()).objects).toEqual(objects);
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

for (const method of ["POST", "DELETE"] as const)
  contractWith(
    it,
    "BASE-ACCESS-002 BASE-DATA-003 ISSUE-009",
    `native signout after authorized ${method} file intent preserves the acknowledged settlement`,
    async () => {
      const f = await privateFixture();
      const effect = method === "POST" ? "put" : "delete";
      let effects = 0;
      const bucket = new Proxy(env.FILES, {
        get(target, key) {
          const value = Reflect.get(target, key, target);
          if (key === effect)
            return async (...args: unknown[]) => {
              const result = await (value as Function).apply(target, args);
              effects++;
              await f.change("signout");
              return result;
            };
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const response = await callPrivate(
        `/issues/${f.issue.identifier}/files${method === "DELETE" ? `/${f.file.id}` : ""}`,
        f.bobCookie,
        {
          method,
          headers: {
            "content-type": "text/plain",
            "x-file-name": "Authorized.txt",
          },
          ...(method === "POST" ? { body: "Authorized settled bytes" } : {}),
        },
        { FILES: bucket },
      );
      expect(response.status, await response.clone().text()).toBe(
        method === "POST" ? 201 : 200,
      );
      expect(effects).toBe(1);
      const id =
        method === "POST"
          ? ((await response.json()) as { id: string }).id
          : f.file.id;
      const row = await env.DB.prepare(
        "SELECT state,writer_settled,removal_confirmed_at,blob_key FROM issue_files WHERE id=?",
      )
        .bind(id)
        .first<{
          state: string;
          writer_settled: number;
          removal_confirmed_at: string | null;
          blob_key: string;
        }>();
      expect(row!.writer_settled).toBe(1);
      if (method === "POST") {
        expect(row!.state).toBe("ready");
        expect(row!.removal_confirmed_at).toBeNull();
        const download = await callPrivate(
          `/issues/${f.issue.identifier}/files/${id}`,
          f.cookie,
        );
        expect(download.status).toBe(200);
        expect(await download.text()).toBe("Authorized settled bytes");
      } else {
        expect(row!.removal_confirmed_at).not.toBeNull();
        expect(await env.FILES.get(row!.blob_key)).toBeNull();
      }
      expect(
        (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
      ).toEqual([]);
    },
  );

contractWith(
  it,
  "BASE-ACCESS-004 ISSUE-009",
  "foreign file upload is denied before its private body is read",
  async () => {
    const f = await privateFixture();
    await f.change("workspace");
    let reads = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads++;
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const response = await callPrivate(
      `/issues/${f.issue.identifier}/files`,
      f.bobCookie,
      {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "x-file-name": "Rejected.txt",
        },
        body,
      },
    );
    expectPrivateDenial(response, await response.text(), 404);
    expect(reads).toBe(0);
  },
);
