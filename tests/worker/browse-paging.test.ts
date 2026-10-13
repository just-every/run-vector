import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { testCookie } from "./native-fixture";
import { issueListLayoutQuery } from "../../src/core/features/issues/ui/issue-list-controls";
import { browseFixture, ids, priorities } from "./browse-fixture";
import { createUlid } from "../../src/core/shared/ids";
import { listIssues } from "../../src/core/features/issues/list";
import {
  issueListQuerySchema,
  type IssueListQuery,
} from "../../src/core/features/issues/list-schema";
let fixture: Awaited<ReturnType<typeof browseFixture>>;
let cookie: string;
let specimens: Awaited<ReturnType<typeof browseFixture>>["rows"];
beforeAll(async () => {
  fixture = await browseFixture();
  cookie = await testCookie(env.DB, ids.sarah);
  specimens = Array.from({ length: 315 }, (_, i) => ({
    ...fixture.rows[i % fixture.rows.length],
    id: createUlid(new Date()),
    identifier: `PGP-${i + 1}`,
    title: `Paging regression ${i}`,
  }));
  await env.DB.batch(
    specimens.map((r, i) =>
      env.DB.prepare(
        `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,assignee_operator_id,project_id,cycle_id,due_date,created_at,updated_at) VALUES(?,?,'PGP',?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        r.id,
        r.identifier,
        i + 1,
        r.team,
        r.title,
        r.status,
        r.priority,
        r.assignee,
        r.project,
        r.cycle,
        r.due,
        r.created,
        r.updated,
      ),
    ),
  );
});
const read = (input: Partial<IssueListQuery> = {}) =>
  listIssues(
    env.DB,
    ids.sarah,
    issueListQuerySchema.parse({ q: "Paging regression", ...input }),
  );
const lexical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const orders = {
  newest: (a: (typeof specimens)[number], b: (typeof specimens)[number]) =>
    lexical(b.created, a.created),
  oldest: (a: (typeof specimens)[number], b: (typeof specimens)[number]) =>
    lexical(a.created, b.created),
  updated: (a: (typeof specimens)[number], b: (typeof specimens)[number]) =>
    lexical(b.updated, a.updated),
  priority: (a: (typeof specimens)[number], b: (typeof specimens)[number]) =>
    priorities.indexOf(a.priority) - priorities.indexOf(b.priority),
  status: (a: (typeof specimens)[number], b: (typeof specimens)[number]) =>
    a.position - b.position,
  due: (a: (typeof specimens)[number], b: (typeof specimens)[number]) =>
    lexical(a.due ?? "9999", b.due ?? "9999"),
};
it("[VIEW-001] all seven groupings and six sorts are globally contiguous across more than two pages, with stable complete metadata", async () => {
  const normal = specimens.filter((r) => r.category !== "completed");
  expect(normal.length).toBeGreaterThan(150);
  for (const grouping of [
    "none",
    "status",
    "assignee",
    "priority",
    "project",
    "cycle",
    "team",
  ] as const) {
    for (const sort of Object.keys(orders) as (keyof typeof orders)[]) {
      const first = await read({ grouping, sort });
      const pages = [first];
      for (
        let offset = first.pageSize;
        offset < first.total;
        offset += first.pageSize
      )
        pages.push(await read({ grouping, sort, offset, revision: first.revision }));
      expect(first.pageSize).toBe(50);
      expect(pages.length).toBeGreaterThan(2);
      for (const page of pages) {
        expect(page.groups).toEqual(first.groups);
        expect(
          page.groups.reduce((total, group) => total + group.count, 0),
        ).toBe(normal.length);
      }
      const rows = pages.flatMap((page) => page.issues);
      expect(new Set(rows.map((row) => row.identifier)).size).toBe(
        normal.length,
      );
      expect(rows.map((row) => row.identifier).sort()).toEqual(
        normal.map((row) => row.identifier).sort(),
      );
      const groupRank = new Map(first.groups.map((group, i) => [group.key, i]));
      const memberships = new Map(
        rows.map((row) => [row.identifier, row.groupKey]),
      );
      const expected = [...normal].sort(
        (a, b) =>
          groupRank.get(memberships.get(a.identifier)!)! -
            groupRank.get(memberships.get(b.identifier)!)! ||
          orders[sort](a, b) ||
          lexical(a.identifier, b.identifier),
      );
      expect(rows.map((row) => row.identifier)).toEqual(
        expected.map((row) => row.identifier),
      );
      for (const group of first.groups)
        expect(rows.filter((row) => row.groupKey === group.key).length).toBe(
          group.count,
        );
    }
  }
});
it("[VIEW-005 VIEW-001] bounded board pages exceed fifty, reach every card, and retain true status totals independent of grouping and completed filters", async () => {
  const team = fixture.teams[0].id;
  for (const category of ["all", "completed"] as const) {
    const normal = specimens.filter(
      (row) =>
        row.team === team &&
        (category === "all"
          ? row.category !== "completed"
          : row.category === category),
    );
    const expected = Object.fromEntries(
      fixture.statuses
        .filter((status) => status.team_id === team)
        .map((status) => [
          status.id,
          normal.filter((row) => row.status === status.id).length,
        ])
        .filter(([, count]) => count),
    );
    for (const grouping of ["none", "priority", "assignee"] as const) {
      const first = await read({ team, category, grouping, pageSize: 100 });
      expect(first.pageSize).toBe(100);
      expect(first.total).toBe(normal.length);
      if (category === "all") expect(first.issues).toHaveLength(100);
      expect(
        Object.fromEntries(
          first.statusCounts!.map((group) => [group.key, group.count]),
        ),
      ).toEqual(expected);
      const pages = [first];
      for (let offset = 100; offset < first.total; offset += 100)
        pages.push(
          await read({ team, category, grouping, pageSize: 100, offset, revision: first.revision }),
        );
      for (const page of pages)
        expect(page.statusCounts).toEqual(first.statusCounts);
      const identifiers = pages.flatMap((page) =>
        page.issues.map((row) => row.identifier),
      );
      expect(new Set(identifiers).size).toBe(normal.length);
      expect(identifiers.sort()).toEqual(
        normal.map((row) => row.identifier).sort(),
      );
    }
  }
  const done = fixture.statuses.find(
    (status) => status.team_id === team && status.category === "completed",
  )!;
  const exact = await read({ team, status: done.id, pageSize: 100 });
  expect(
    exact.statusCounts!.find((group) => group.key === done.id)?.count,
  ).toBe(exact.total);
  expect(exact.total).toBeGreaterThan(0);
});

it("[VIEW-005] status totals are returned by SQL independently of the chosen grouping and page", async () => {
  const team = fixture.teams[0].id;
  const expected = specimens.filter(
    (row) => row.team === team && row.category !== "completed",
  );
  const first = await read({ team, grouping: "assignee", pageSize: 100 });
  const second = await read({
    team,
    grouping: "assignee",
    pageSize: 100,
    offset: 100,
    revision: first.revision,
  });
  expect(first.statusCounts).toBeDefined();
  expect(first.statusCounts).toEqual(second.statusCounts);
  expect(
    first.statusCounts!.reduce((total, status) => total + status.count, 0),
  ).toBe(expected.length);
  for (const status of first.statusCounts!)
    expect(status.count).toBe(
      expected.filter((row) => row.status === status.key).length,
    );
});

it("[VIEW-001] REST projects only page-present groups and preserves complete SQL metadata as allGroups", async () => {
  const app = createServerApp(),
    origin = "https://vector.test";
  const first = await read({ grouping: "priority" });
  for (const offset of [0, 50, first.total]) {
    const service = await read({ grouping: "priority", offset, revision: first.revision });
    const response = await app.request(
      origin +
        `/api/issues?q=Paging%20regression&grouping=priority&offset=${offset}&revision=${first.revision}`,
      { headers: { cookie } },
      { ...env, APP_ORIGIN: origin },
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as typeof service;
    expect(data.allGroups).toEqual(service.groups);
    expect(data.allGroups!.reduce((sum, group) => sum + group.count, 0)).toBe(
      first.total,
    );
    expect(data.groups).toEqual(
      service.groups.filter((group) =>
        service.issues.some((row) => row.groupKey === group.key),
      ),
    );
    expect(data.issues).toEqual(service.issues);
    expect(
      data.groups.every((group) =>
        data.issues.some((row) => row.groupKey === group.key),
      ),
    ).toBe(true);
  }
  const board = await app.request(
    origin +
      `/api/issues?q=Paging%20regression&team=${fixture.teams[0].id}&pageSize=100&grouping=assignee`,
    { headers: { cookie } },
    { ...env, APP_ORIGIN: origin },
  );
  expect(board.status).toBe(200);
  const data = (await board.json()) as typeof first;
  expect(data.pageSize).toBe(100);
  expect(data.issues).toHaveLength(100);
  expect(
    data.statusCounts!.reduce((sum, status) => sum + status.count, 0),
  ).toBe(data.total);
  expect(
    (
      await app.request(
        origin + "/api/issues?pageSize=101",
        { headers: { cookie } },
        { ...env, APP_ORIGIN: origin },
      )
    ).status,
  ).toBe(400);
});

it("[VIEW-005 VIEW-001] board workflow SQL grouping preserves each column's six selected sorts across all pages when stored grouping differs", async () => {
  const team = fixture.teams[0].id;
  const expected = specimens.filter(
    (row) => row.team === team && row.category !== "completed",
  );
  for (const grouping of ["assignee", "project"] as const) {
    for (const sort of Object.keys(orders) as (keyof typeof orders)[]) {
      const stored = issueListQuerySchema.parse({
        q: "Paging regression",
        team,
        grouping,
        sort,
      });
      const effective = issueListLayoutQuery(stored, "board");
      expect(stored.grouping).toBe(grouping);
      expect(stored.pageSize).toBe(50);
      expect(effective.grouping).toBe("status");
      expect(effective.pageSize).toBe(100);
      const first = await read(effective),
        pages = [first];
      for (
        let offset = first.pageSize;
        offset < first.total;
        offset += first.pageSize
      )
        pages.push(await read({ ...effective, offset, revision: first.revision }));
      const rows = pages.flatMap((page) => page.issues);
      expect(new Set(rows.map((row) => row.identifier)).size).toBe(
        expected.length,
      );
      for (const status of fixture.statuses.filter(
        (status) => status.team_id === team,
      )) {
        const column = expected
          .filter((row) => row.status === status.id)
          .sort(
            (a, b) => orders[sort](a, b) || lexical(a.identifier, b.identifier),
          );
        expect(
          rows
            .filter((row) => row.status.id === status.id)
            .map((row) => row.identifier),
        ).toEqual(column.map((row) => row.identifier));
      }
    }
  }
});
