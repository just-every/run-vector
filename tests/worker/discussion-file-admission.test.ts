import { env } from "cloudflare:workers";
import { afterEach, expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { beforeCommit } from "./removal-interleaving";
import { addFile } from "../../src/core/features/discussion/repository";
import { createUlid } from "../../src/core/shared/ids";
import {
  cleanupPrivateFixtures,
  callPrivate,
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
  for (const phase of ["entry", "source-transaction"] as const)
    contractWith(
      it,
      "BASE-ACCESS-004 ISSUE-009 BASE-DATA-003",
      `file ${method} rejects foreign workspace at ${phase} without records or R2 effects`,
      async () => {
        const f = await privateFixture();
        let before: Awaited<ReturnType<typeof privateState>> | undefined;
        const change = async () => {
          await f.change("workspace");
          before = await privateState();
        };
        if (phase === "entry") await change();
        const db =
          phase === "entry"
            ? env.DB
            : beforeCommit(
                (query) =>
                  query.includes(
                    method === "POST"
                      ? "INSERT INTO issue_files"
                      : "UPDATE issue_files SET",
                  ),
                change,
              );
        const observed = observedBucket();
        const objects = (await env.FILES.list()).objects;
        const path = `/issues/${f.issue.identifier}/files${method === "DELETE" ? `/${f.file.id}` : ""}`;
        const response = await callPrivate(
          path,
          f.bobCookie,
          {
            method,
            headers: {
              "content-type": "text/plain",
              "x-file-name": "Rejected.txt",
            },
            ...(method === "POST" ? { body: "Rejected private bytes" } : {}),
          },
          { DB: db, FILES: observed.bucket },
        );
        expect(before).toBeDefined();
        expectPrivateDenial(response, await response.text(), 404);
        expect(await privateState()).toEqual(before);
        expect(observed.calls).toEqual({ get: 0, put: 0, delete: 0 });
        expect((await env.FILES.list()).objects).toEqual(objects);
        const peer = await callPrivate(path, f.cookie, {
          method,
          headers: {
            "content-type": "text/plain",
            "x-file-name": "Accepted.txt",
          },
          ...(method === "POST" ? { body: "Active operator bytes" } : {}),
        });
        expect(peer.status, await peer.clone().text()).toBe(
          method === "POST" ? 201 : 200,
        );
      },
    );
