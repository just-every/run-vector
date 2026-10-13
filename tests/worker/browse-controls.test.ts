import { createUlid } from "../../src/core/shared/ids";
import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { listIssues } from "../../src/core/features/issues/list";
import {
  issueListQuerySchema,
  issueListSchema,
  type IssueListQuery,
} from "../../src/core/features/issues/list-schema";
import { browseFixture, ids, categories, priorities } from "./browse-fixture";
let fixture: Awaited<ReturnType<typeof browseFixture>>;
beforeAll(async () => {
  fixture = await browseFixture();
});
const query = (input: Partial<IssueListQuery> = {}) =>
  issueListQuerySchema.parse({ q: "Browse specimen", ...input });
const read = (input: Partial<IssueListQuery> = {}) =>
  listIssues(env.DB, ids.sarah, query(input), new Date("2026-10-03T12:00:00Z"));
type Row = Awaited<ReturnType<typeof browseFixture>>["rows"][number];
async function assertRows(
  input: Partial<IssueListQuery>,
  predicate: (r: Row) => boolean,
) {
  const first = issueListSchema.parse(await read(input)),
    expected = fixture.rows.filter(predicate);
  const pages = [...first.issues];
  if (first.total > 50)
    pages.push(...(await read({ ...input, offset: 50, revision: first.revision })).issues);
  expect(first.total).toBe(expected.length);
  expect(pages.map((r) => r.identifier).sort()).toEqual(
    expected.map((r) => r.identifier).sort(),
  );
  return first;
}
it("[VIEW-001 REL-002] every filter and combined predicates select SQL rows across more than a page", async () => {
  const normal = (r: Row) => r.category !== "completed";
  expect((await assertRows({}, normal)).total).toBeGreaterThan(50);
  for (const category of categories)
    await assertRows(
      { category: category as IssueListQuery["category"] },
      (r) => r.category === category,
    );
  for (const priority of priorities)
    await assertRows(
      { priority: priority as IssueListQuery["priority"] },
      (r) => normal(r) && r.priority === priority,
    );
  for (const team of fixture.teams)
    await assertRows({ team: team.id }, (r) => normal(r) && r.team === team.id);
  for (const status of fixture.statuses.filter((s) =>
    fixture.teams.some((t) => t.id === s.team_id),
  ))
    await assertRows({ status: status.id }, (r) => r.status === status.id);
  await assertRows(
    { assignee: "unassigned" },
    (r) => normal(r) && r.assignee === null,
  );
  await assertRows(
    { assignee: ids.sarah },
    (r) => normal(r) && r.assignee === ids.sarah,
  );
  await assertRows(
    { project: fixture.project },
    (r) => normal(r) && r.project === fixture.project,
  );
  await assertRows({ project: "none" }, (r) => normal(r) && r.project === null);
  await assertRows(
    { cycle: fixture.cycle.id },
    (r) => normal(r) && r.cycle === fixture.cycle.id,
  );
  await assertRows({ cycle: "none" }, (r) => normal(r) && r.cycle === null);
  await assertRows({ label: fixture.label }, (r) => normal(r) && r.label);
  await assertRows({ label: "none" }, (r) => normal(r) && !r.label);
  await assertRows({ due: "none" }, (r) => normal(r) && r.due === null);
  await assertRows(
    { due: "range", dueFrom: "2026-10-03", dueTo: "2026-10-03" },
    (r) => normal(r) && r.due === "2026-10-03",
  );
  await assertRows(
    { due: "range", dueFrom: "2026-10-02", dueTo: "2026-10-03" },
    (r) => normal(r) && r.due !== null,
  );
  await assertRows(
    { due: "range", dueFrom: "2026-10-03" },
    (r) => normal(r) && r.due === "2026-10-03",
  );
  await assertRows(
    { due: "range", dueTo: "2026-10-02" },
    (r) => normal(r) && r.due === "2026-10-02",
  );
  await assertRows({ blocked: "blocked" }, (r) => normal(r) && r.blocked);
  await assertRows({ blocked: "unblocked" }, (r) => normal(r) && !r.blocked);
  await assertRows(
    { parent: "BRW-1" },
    (r) => normal(r) && r.parent === fixture.rows[0].id,
  );
  await assertRows({ parent: "none" }, (r) => normal(r) && r.parent === null);
  const combined = {
    category: "backlog" as const,
    priority: "medium" as const,
    assignee: ids.sarah,
    team: fixture.teams[0].id,
    project: fixture.project,
    label: fixture.label,
    blocked: "blocked" as const,
    parent: "BRW-1",
    due: "none" as const,
  };
  const combinedResult = await assertRows(
    combined,
    (r) =>
      r.category === "backlog" &&
      r.priority === "medium" &&
      r.assignee === ids.sarah &&
      r.team === combined.team &&
      r.project === combined.project &&
      r.label &&
      r.blocked &&
      r.parent === fixture.rows[0].id &&
      r.due === null,
  );
  expect(combinedResult.total).toBeGreaterThan(0);
});
it("[VIEW-001] all six sorts use identifier ties and stable fifty-row paging", async () => {
  const orders: Record<IssueListQuery["sort"], (a: Row, b: Row) => number> = {
    newest: (a, b) => b.created.localeCompare(a.created),
    oldest: (a, b) => a.created.localeCompare(b.created),
    updated: (a, b) => b.updated.localeCompare(a.updated),
    priority: (a, b) =>
      priorities.indexOf(a.priority) - priorities.indexOf(b.priority),
    status: (a, b) => a.position - b.position,
    due: (a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"),
  };
  for (const [sort, compare] of Object.entries(orders)) {
    const first = await read({ sort: sort as IssueListQuery["sort"] }),
      second = await read({ sort: sort as IssueListQuery["sort"], offset: 50, revision: first.revision });
    expect(first.issues).toHaveLength(50);
    const expected = fixture.rows
      .filter((r) => r.category !== "completed")
      .sort(
        (a, b) => compare(a, b) || a.identifier.localeCompare(b.identifier),
      );
    expect(
      [...first.issues, ...second.issues].map((r) => r.identifier),
    ).toEqual(expected.map((r) => r.identifier));
  }
});
it("[VIEW-001] group counts cover the entire predicate and never fabricate empty groups", async () => {
  for (const grouping of [
    "none",
    "status",
    "assignee",
    "priority",
    "project",
    "cycle",
    "team",
  ] as const) {
    const first = await read({ grouping }),
      second = await read({ grouping, offset: 50, revision: first.revision });
    expect(first.groups).toEqual(second.groups);
    expect(first.groups.reduce((n, g) => n + g.count, 0)).toBe(first.total);
    const actual = new Map<string, number>();
    for (const r of [...first.issues, ...second.issues])
      actual.set(r.groupKey, (actual.get(r.groupKey) ?? 0) + 1);
    expect(
      Object.fromEntries(first.groups.map((g) => [g.key, g.count])),
    ).toEqual(Object.fromEntries(actual));
    expect((await read({ grouping, q: "no synthetic match" })).groups).toEqual(
      [],
    );
  }
});
it("[VIEW-001 REL-002] enriches rows and uses workspace dates for overdue, independently of UTC", async () => {
  await env.DB.prepare(
    "UPDATE workspace_settings SET timezone='Pacific/Kiritimati' WHERE id=?",
  )
    .bind(ids.workspace)
    .run();
  await assertRows(
    { due: "overdue" },
    (r) => r.category !== "completed" && r.due !== null,
  );
  await env.DB.prepare(
    "UPDATE workspace_settings SET timezone='America/Los_Angeles' WHERE id=?",
  )
    .bind(ids.workspace)
    .run();
  await assertRows(
    { due: "overdue" },
    (r) => r.category !== "completed" && r.due === "2026-10-02",
  );
  const data = await read({ parent: "BRW-1", label: fixture.label });
  for (const row of data.issues) {
    expect(row.parent?.identifier).toBe("BRW-1");
    expect(row.labels.map((l) => l.id)).toContain(fixture.label);
    expect(row.project?.name).toBeTruthy();
    expect(row.createdAt).toBeTruthy();
  }
  for (const category of ["completed", "canceled", "duplicate"]) {
    await env.DB.prepare(
      "UPDATE issues SET status_id=(SELECT id FROM workflow_statuses WHERE team_id=issues.team_id AND category=?) WHERE id=?",
    )
      .bind(category, fixture.rows[1].id)
      .run();
    expect((await read({ blocked: "blocked" })).total).toBe(0);
  }
});
it("[VIEW-001] browsing never uses snapshot or unbounded issue reads and rejects malformed controls", async () => {
  const sql: string[] = [];
  const db = new Proxy(env.DB, {
    get(target, key) {
      if (key === "prepare")
        return (text: string) => {
          sql.push(text);
          if (
            /\bFROM\s+["`]?issues["`]?\b/i.test(text) &&
            !/COUNT\(\*\)|LIMIT 50 OFFSET/i.test(text)
          )
            throw Error("Unbounded projection");
          return target.prepare(text);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await listIssues(db, ids.sarah, query());
  expect(sql.some((s) => s.includes("LIMIT 50 OFFSET ?"))).toBe(true);
  expect(
    sql
      .filter((s) => s.includes("FROM issues i"))
      .every((s) => /COUNT\(\*\)|LIMIT 50/.test(s)),
  ).toBe(true);
  for (const value of [
    { dueFrom: "2026-02-30" },
    { dueFrom: "2026-10-02", dueTo: "2026-10-01" },
    { parent: "bad" },
    { status: "bad" },
    { grouping: "bad" },
    { sort: "bad" },
  ])
    expect(issueListQuerySchema.safeParse(value).success).toBe(false);
});

it("[VIEW-001 OPS-004] terminal assignments retained after removal filter consistently with their unassigned projection", async () => {
  const operator = createUlid(new Date());
  await env.DB.prepare(
    "INSERT INTO operators(id,workspace_id,name,email,removed_at,created_at,updated_at) VALUES(?,?,'Removed operator',?,'now','now','now')",
  )
    .bind(operator, ids.workspace, operator + "@removed.invalid")
    .run();
  await env.DB.prepare("UPDATE issues SET assignee_operator_id=? WHERE id=?")
    .bind(operator, fixture.rows[5].id)
    .run();
  const data = await read({
    category: "canceled",
    assignee: "unassigned",
    grouping: "assignee",
  });
  expect(
    data.issues.find((row) => row.id === fixture.rows[5].id)?.assignee,
  ).toBeNull();
  expect(data.groups.every((group) => group.key === "none")).toBe(true);
});
it("[VIEW-001] browse predicates use dedicated SQL indexes", async () => {
  for (const [sql, values, index] of [
    [
      "SELECT identifier FROM issues WHERE team_id=? AND due_date<? ORDER BY due_date,identifier LIMIT 50",
      [ids.flow, "2026-10-03"],
      "issues_browse_due",
    ],
    [
      "SELECT issue_id FROM issue_parents WHERE parent_issue_id=? LIMIT 50",
      [fixture.rows[0].id],
      "issue_parents_parent_idx",
    ],
    [
      "SELECT identifier FROM issues WHERE team_id=? AND priority=? ORDER BY identifier LIMIT 50",
      [ids.flow, "urgent"],
      "issues_browse_priority",
    ],
  ] as const) {
    const plan = await env.DB.prepare("EXPLAIN QUERY PLAN " + sql)
      .bind(...values)
      .all();
    expect(JSON.stringify(plan.results)).toContain(index);
  }
});
