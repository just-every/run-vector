import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { browseFixture, ids, priorities } from "./browse-fixture";
import { createUlid } from "../../src/core/shared/ids";
import { listIssues } from "../../src/core/features/issues/list";
import {
  issueListQuerySchema,
  type IssueListQuery,
} from "../../src/core/features/issues/list-schema";

type Specimen = {
  id: string;
  identifier: string;
  title: string;
  team: string;
  status: string;
  category: string;
  position: number;
  priority: (typeof priorities)[number];
  due: string | null;
  created: string;
  updated: string;
};

const queryText = "Concentrated board";
const categories = [
  "backlog",
  "started",
  "intake",
  "unstarted",
  "completed",
  "canceled",
  "duplicate",
] as const;
const lexical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const orders = {
  newest: (a: Specimen, b: Specimen) => lexical(b.created, a.created),
  oldest: (a: Specimen, b: Specimen) => lexical(a.created, b.created),
  updated: (a: Specimen, b: Specimen) => lexical(b.updated, a.updated),
  priority: (a: Specimen, b: Specimen) =>
    priorities.indexOf(a.priority) - priorities.indexOf(b.priority),
  due: (a: Specimen, b: Specimen) => lexical(a.due ?? "9999", b.due ?? "9999"),
  status: (a: Specimen, b: Specimen) => a.position - b.position,
};

let fixture: Awaited<ReturnType<typeof browseFixture>>;
let specimens: Specimen[];

beforeAll(async () => {
  fixture = await browseFixture();
  const team = fixture.teams[0].id;
  const statuses = fixture.statuses.filter((status) => status.team_id === team);
  const byCategory = new Map(statuses.map((status) => [status.category, status]));
  const distribution: Array<[string, number]> = [
    ["backlog", 135],
    ...categories.slice(1).map((category): [string, number] => [category, 3]),
  ];
  let sequence = 0;
  specimens = distribution.flatMap(([category, count]) => {
    const status = byCategory.get(category);
    expect(status, `fixture has ${category} workflow status`).toBeDefined();
    return Array.from({ length: count }, () => {
      const index = sequence++;
      const day = String(1 + ((index * 11) % 28)).padStart(2, "0");
      const hour = String((index * 7) % 24).padStart(2, "0");
      return {
        id: createUlid(new Date()),
        identifier: `CBR-${index + 1}`,
        title: `${queryText} item ${index + 1}`,
        team,
        status: status!.id,
        category,
        position: status!.position,
        priority: priorities[index % priorities.length],
        due:
          index % 4 === 0
            ? null
            : `2026-10-${String(1 + ((index * 5) % 28)).padStart(2, "0")}`,
        created: `2026-09-${day}T${hour}:00:00Z`,
        updated: `2026-10-${day}T${String((index * 13) % 24).padStart(2, "0")}:00:00Z`,
      };
    });
  });
  await env.DB.batch(
    specimens.map((row, index) =>
      env.DB.prepare(
        "INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,due_date,created_at,updated_at) VALUES(?,?,'CBR',?,?,?,?,?,?,?,?)",
      ).bind(
        row.id,
        row.identifier,
        index + 1,
        row.team,
        row.title,
        row.status,
        row.priority,
        row.due,
        row.created,
        row.updated,
      ),
    ),
  );
});

const read = (input: Partial<IssueListQuery> = {}) =>
  listIssues(
    env.DB,
    ids.sarah,
    issueListQuerySchema.parse({
      q: queryText,
      team: fixture.teams[0].id,
      grouping: "status",
      pageSize: 100,
      ...input,
    }),
  );

const expectedCounts = (rows: Specimen[], statuses: typeof fixture.statuses) =>
  new Map(
    statuses.map((status) => [
      status.id,
      rows.filter((row) => row.status === status.id).length,
    ]),
  );

it("[VIEW-005 VIEW-001] concentrated workflow status pages retain true counts and selected sort order", async () => {
  const team = fixture.teams[0].id;
  const statuses = fixture.statuses.filter((status) => status.team_id === team);
  const rows = specimens.filter((row) => row.category !== "completed");
  const counts = expectedCounts(rows, statuses);
  const backlog = statuses.find((status) => status.category === "backlog")!;
  expect(rows.filter((row) => row.status === backlog.id)).toHaveLength(135);
  expect(rows.length).toBe(150);

  for (const sort of Object.keys(orders) as (keyof typeof orders)[]) {
    const pages = [];
    const revision = (await read({ sort })).revision;
    for (const offset of [0, 100]) {
      const page = await read({ sort, offset, revision });
      expect(page.pageSize).toBe(100);
      expect(page.offset).toBe(offset);
      expect(page.total).toBe(rows.length);
      expect(page.issues).toHaveLength(offset === 0 ? 100 : 50);
      expect(
        [...page.statusCounts!.map(({ key, count }) => [key, count] as const)].sort(
          ([a], [b]) => lexical(a, b),
        ),
      ).toEqual(
        [...counts]
          .filter(([, count]) => count > 0)
          .map(([key, count]) => [key, count] as const)
          .sort(([a], [b]) => lexical(a, b)),
      );
      expect(
        page.statusCounts!.reduce((total, status) => total + status.count, 0),
      ).toBe(page.total);
      expect(
        page.groups.map(({ key, count }) => [key, count]),
      ).toEqual(
        statuses
          .filter((status) => (counts.get(status.id) ?? 0) > 0)
          .sort((a, b) => a.position - b.position)
          .map((status) => [status.id, counts.get(status.id)]),
      );
      pages.push(page);
    }

    expect(pages[0].statusCounts).toEqual(pages[1].statusCounts);
    expect(
      pages[0].issues.filter((row) => row.status.id === backlog.id).length,
    ).toBeLessThan(135);
    expect(
      pages[1].issues.filter((row) => row.status.id === backlog.id).length,
    ).toBeGreaterThan(0);
    const listed = pages.flatMap((page) => page.issues);
    expect(new Set(listed.map((row) => row.identifier)).size).toBe(rows.length);
    expect(listed.map((row) => row.identifier).sort()).toEqual(
      rows.map((row) => row.identifier).sort(),
    );

    for (const status of statuses) {
      const expected = rows
        .filter((row) => row.status === status.id)
        .sort(
          (a, b) => orders[sort](a, b) || lexical(a.identifier, b.identifier),
        );
      expect(
        listed
          .filter((row) => row.status.id === status.id)
          .map((row) => row.identifier),
      ).toEqual(expected.map((row) => row.identifier));
    }
  }

  const completed = statuses.find((status) => status.category === "completed")!;
  const doneRows = specimens.filter((row) => row.category === "completed");
  const done = await read({ status: completed.id });
  expect(done.total).toBe(doneRows.length);
  expect(done.statusCounts).toEqual([{ key: completed.id, count: doneRows.length }]);
  expect(done.issues.map((row) => row.identifier).sort()).toEqual(
    doneRows.map((row) => row.identifier).sort(),
  );
});
