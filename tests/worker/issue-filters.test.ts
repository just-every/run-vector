import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { testCookie } from "./native-fixture";
import {
  issueListQuerySchema,
  issueListSchema,
  type IssueListQuery,
} from "../../src/core/features/issues/list-schema";
import { browseFixture, ids, categories, priorities } from "./browse-fixture";
let cookie: string;
let fixture: Awaited<ReturnType<typeof browseFixture>>;
beforeAll(async () => {
  fixture = await browseFixture();
  cookie = await testCookie(env.DB, ids.sarah);
});
const query = (input: Partial<IssueListQuery> = {}) =>
  issueListQuerySchema.parse({ q: "Browse specimen", ...input });
async function read(input: Partial<IssueListQuery> = {}) {
  const search = new URLSearchParams(
    Object.entries(query(input)).map(([key, value]) => [key, String(value)]),
  );
  const response = await createServerApp().request(
    "https://vector.test/api/issues?" + search,
    { headers: { cookie } },
    { ...env, APP_ORIGIN: "https://vector.test" },
  );
  expect(response.status).toBe(200);
  return issueListSchema.parse(await response.json());
}
type Row = Awaited<ReturnType<typeof browseFixture>>["rows"][number];
async function assertRows(
  input: Partial<IssueListQuery>,
  predicate: (r: Row) => boolean,
) {
  const first = issueListSchema.parse(await read(input)),
    expected = fixture.rows.filter(predicate);
  const pages = [...first.issues];
  if (first.total > 50)
    pages.push(
      ...(await read({ ...input, offset: 50, revision: first.revision }))
        .issues,
    );
  expect(first.total).toBe(expected.length);
  expect(pages.map((r) => r.identifier).sort()).toEqual(
    expected.map((r) => r.identifier).sort(),
  );
  return first;
}
it("[VIEW-001 REL-002] native issue browsing applies filters, ordering, grouping and workspace dates to stored records", async () => {
  // Scenario: "[VIEW-001 REL-002] every filter and combined predicates select SQL rows across more than a page"
  await (async () => {
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
      await assertRows(
        { team: team.id },
        (r) => normal(r) && r.team === team.id,
      );
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
    await assertRows(
      { project: "none" },
      (r) => normal(r) && r.project === null,
    );
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
  })();
  // Scenario: "[VIEW-001] all six sorts use identifier ties and stable fifty-row paging"
  await (async () => {
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
        second = await read({
          sort: sort as IssueListQuery["sort"],
          offset: 50,
          revision: first.revision,
        });
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
  })();
  // Scenario: "[VIEW-001] group counts cover the entire predicate and never fabricate empty groups"
  await (async () => {
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
      expect(first.allGroups!).toEqual(second.allGroups!);
      expect(first.allGroups!.reduce((n, g) => n + g.count, 0)).toBe(
        first.total,
      );
      const actual = new Map<string, number>();
      for (const r of [...first.issues, ...second.issues])
        actual.set(r.groupKey, (actual.get(r.groupKey) ?? 0) + 1);
      expect(
        Object.fromEntries(first.allGroups!.map((g) => [g.key, g.count])),
      ).toEqual(Object.fromEntries(actual));
      expect(
        (await read({ grouping, q: "no synthetic match" })).groups,
      ).toEqual([]);
    }
  })();
  // Scenario: "[VIEW-001 REL-002] enriches rows and uses workspace dates for overdue, independently of UTC"
  await (async () => {
    // Choose real local dates on opposite sides of the date line; no application clock is mocked.
    const at = new Date();
    const localDate = (timeZone: string) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(at);
    const westDate = localDate("Etc/GMT+12"),
      eastDate = localDate("Pacific/Kiritimati");
    expect(eastDate > westDate).toBe(true);
    for (const row of fixture.rows) if (row.due !== null) row.due = westDate;
    await env.DB.prepare(
      "UPDATE issues SET due_date=? WHERE identifier LIKE 'BRW-%' AND due_date IS NOT NULL",
    )
      .bind(westDate)
      .run();
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
      "UPDATE workspace_settings SET timezone='Etc/GMT+12' WHERE id=?",
    )
      .bind(ids.workspace)
      .run();
    await assertRows({ due: "overdue" }, (r) => false);
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
  })();
});
