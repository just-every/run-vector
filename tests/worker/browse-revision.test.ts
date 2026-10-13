import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { setup, create, call, ids } from "./bulk-parent-fixture";
import { listIssues } from "../../src/core/features/issues/list";
import { issueListQuerySchema } from "../../src/core/features/issues/list-schema";
import { beforeCommit } from "./removal-interleaving";
import { createUlid } from "../../src/core/shared/ids";
import { createView } from "../../src/core/features/views/service";
import { normalizePreference } from "../../src/core/features/views/preferences";
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
const read = (extra = {}, db = env.DB, date = "2026-10-09T12:00:00Z") =>
  listIssues(db, ids.sarah, query(extra), new Date(date));
it("[VIEW-001 VIEW-005] HTTP refuses missing, stale and wrong-query identities without mixed rows; unchanged traversal stays complete", async () => {
  for (const pageSize of [50, 100]) {
    const first = await read({ pageSize });
    const second = await read({
      pageSize,
      offset: pageSize,
      revision: first.revision,
    });
    expect(second.revision).toBe(first.revision);
    expect(
      new Set([...first.issues, ...second.issues].map((row) => row.id)).size,
    ).toBe(first.issues.length + second.issues.length);
    for (const revision of ["", "stale", first.revision]) {
      const response = await call(
        `/issues?q=Revision%20specimen&offset=${pageSize}&pageSize=${pageSize}&revision=${revision}`,
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "pagination_invalidated",
        message: "Issues changed. Restart pagination from the first page.",
      });
    }
    await expect(
      read(
        { pageSize, offset: pageSize, revision: first.revision },
        env.DB,
        "2026-10-10T12:00:00Z",
      ),
    ).rejects.toMatchObject({ code: "pagination_invalidated" });
  }
});
it("[VIEW-001 VIEW-005 ISSUE-006] reorder, insert and deletion ahead of page two require fresh traversal for both page sizes", async () => {
  for (const pageSize of [50, 100]) {
    for (const kind of ["reorder", "insert", "delete"]) {
      const first = await read({ pageSize });
      if (kind === "reorder") {
        const second = await read({
          pageSize,
          offset: pageSize,
          revision: first.revision,
        });
        const row = second.issues[0];
        const response = await call(
          `/issues/${row.identifier}`,
          { expectedVersion: row.version, priority: "urgent" },
          "PATCH",
        );
        expect(response.status).toBe(200);
      } else if (kind === "insert")
        await create({ title: "Revision specimen", priority: "urgent" });
      else
        await env.DB.prepare("DELETE FROM issues WHERE id=?")
          .bind(first.issues[0].id)
          .run();
      await expect(
        read({ pageSize, offset: pageSize, revision: first.revision }),
      ).rejects.toMatchObject({ code: "pagination_invalidated" });
      const restarted = await read({ pageSize });
      expect(restarted.revision).not.toBe(first.revision);
      const all = [...restarted.issues];
      for (let offset = pageSize; offset < restarted.total; offset += pageSize)
        all.push(
          ...(await read({ pageSize, offset, revision: restarted.revision }))
            .issues,
        );
      expect(new Set(all.map((row) => row.id)).size).toBe(restarted.total);
    }
  }
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
  await expect(
    read({ pageSize: 100, offset: 100, revision: first.revision }, db),
  ).rejects.toMatchObject({ code: "pagination_invalidated" });
  const fresh = await read({ pageSize: 100 });
  expect(fresh.statusCounts!.reduce((n, row) => n + row.count, 0)).toBe(
    fresh.total,
  );
  expect(fresh.groups.reduce((n, row) => n + row.count, 0)).toBe(fresh.total);
});
it("[VIEW-002 VIEW-003] ephemeral traversal revision is never stored in a view or preference", async () => {
  const first = await read();
  const view = await createView(env.DB, ids.sarah, {
    name: "Revision scope",
    isShared: false,
    layout: "list",
    query: query({ revision: first.revision, offset: 50 }),
  });
  expect(view.query.revision).toBe("");
  const stored = await env.DB.prepare(
    "SELECT filters_json FROM saved_views WHERE id=?",
  )
    .bind(view.id)
    .first<string>("filters_json");
  expect(JSON.parse(stored!)).not.toHaveProperty("revision");
  expect(() =>
    normalizePreference("issues", { filters: { revision: first.revision } }),
  ).toThrow();
});
