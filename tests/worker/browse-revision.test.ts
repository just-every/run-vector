import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { setup, create, call, ids } from "./bulk-parent-fixture";
import {
  issueListQuerySchema,
  issueListSchema,
} from "../../src/core/features/issues/list-schema";
import { beforeCommit } from "./removal-interleaving";
import { createUlid } from "../../src/core/shared/ids";
let rows: any[];
beforeAll(async () => {
  await setup();
  const original = await create({
    title: "Revision specimen",
    priority: "none",
  });
  rows = Array.from({ length: 111 }, (_, index) => ({
    id: createUlid(new Date()),
    identifier: `REV-${index + 1}`,
  }));
  await env.DB.batch(
    rows.map((row, index) =>
      env.DB.prepare(
        `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,created_at,updated_at)
    VALUES(?,?,'REV',?,?,'Revision specimen',?,'none','2026-10-01','2026-10-01')`,
      ).bind(
        row.id,
        row.identifier,
        index + 1,
        original.team.id,
        original.status.id,
      ),
    ),
  );
});
const query = (extra = {}) =>
  issueListQuerySchema.parse({
    q: "Revision specimen",
    sort: "priority",
    team: ids.flow,
    ...extra,
  });
const response = (extra = {}, db = env.DB) =>
  call(
    "/issues?" +
      new URLSearchParams(
        Object.entries(query(extra)).map(([key, value]) => [
          key,
          String(value),
        ]),
      ),
    undefined,
    "GET",
    db,
  );
async function read(extra = {}, db = env.DB) {
  const result = await response(extra, db);
  expect(result.status).toBe(200);
  return issueListSchema.parse(await result.json());
}
it("[VIEW-001 VIEW-005 ISSUE-006] native pagination rejects changed query and changed rows, then restarts without mixing results", async () => {
  const first = await read({ pageSize: 100 });
  for (const revision of ["", "stale", first.revision]) {
    const response = await call(
      "/issues?q=Revision%20specimen&offset=100&pageSize=100&revision=" +
        revision,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "pagination_invalidated",
    });
  }
  const row = first.issues[0];
  expect(
    (
      await call(
        "/issues/" + row.identifier,
        { expectedVersion: row.version, priority: "urgent" },
        "PATCH",
      )
    ).status,
  ).toBe(200);
  const stale = await response({
    pageSize: 100,
    offset: 100,
    revision: first.revision,
  });
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ error: "pagination_invalidated" });
  const restarted = await read({ pageSize: 100 });
  expect(restarted.revision).not.toBe(first.revision);
  const all = [...restarted.issues];
  for (
    let offset = restarted.pageSize;
    offset < restarted.total;
    offset += restarted.pageSize
  )
    all.push(
      ...(await read({ pageSize: 100, offset, revision: restarted.revision }))
        .issues,
    );
  expect(new Set(all.map((row) => row.id)).size).toBe(restarted.total);
  expect(all.find((item) => item.id === row.id)?.priority).toBe("urgent");
});

it("[VIEW-001] mutation at the read transaction boundary cannot mix revision, counts and page rows", async () => {
  const first = await read({ pageSize: 100 });
  const db = beforeCommit(
    (sql) => sql.includes("SELECT CAST(revision"),
    async () => {
      await env.DB.prepare(
        "UPDATE issues SET priority='high',version=version+1 WHERE id=?",
      )
        .bind(rows.at(-1)!.id)
        .run();
    },
  );
  const stale = await response(
    { pageSize: 100, offset: 100, revision: first.revision },
    db,
  );
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ error: "pagination_invalidated" });
  const fresh = await read({ pageSize: 100 });
  expect(fresh.statusCounts!.reduce((n, row) => n + row.count, 0)).toBe(
    fresh.total,
  );
  expect(fresh.allGroups!.reduce((n, row) => n + row.count, 0)).toBe(
    fresh.total,
  );
});
