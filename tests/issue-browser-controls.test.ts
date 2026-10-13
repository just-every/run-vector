import assert from "node:assert/strict";
import { test } from "node:test";
import {
  issueListQuerySchema,
  issueListSchema,
} from "../src/core/features/issues/list-schema.ts";
import {
  changeIssueListFilters,
  issueListReturnPath,
} from "../src/core/features/issues/ui/issue-list-controls.ts";
import {
  issueGroups,
  toggleIssueSelection,
  refreshIssueSelection,
} from "../src/core/features/issues/ui/issue-selection.ts";
import { paletteEntries } from "../src/core/features/search/ui/data.ts";
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
test("[VIEW-001] every combined control survives a URL round trip and changes reset paging", () => {
  const query = issueListQuerySchema.parse({
    q: "words & text",
    category: "started",
    status: id,
    priority: "urgent",
    assignee: "unassigned",
    team: id,
    project: "none",
    cycle: "none",
    label: id,
    due: "range",
    dueFrom: "2026-10-01",
    dueTo: "2026-10-31",
    blocked: "blocked",
    parent: "ENG-4",
    sort: "due",
    grouping: "assignee",
    offset: 50,
  });
  assert.deepEqual(
    issueListQuerySchema.parse(
      Object.fromEntries(
        new URL(issueListReturnPath(query), "http://local").searchParams,
      ),
    ),
    query,
  );
  assert.equal(changeIssueListFilters(query, { sort: "priority" }).offset, 0);
  assert.equal(changeIssueListFilters(query, { offset: 100 }).parent, "ENG-4");
});
test("[VIEW-001 VIEW-004] SQL group counts are retained; selection is immutable and refreshed with current per-issue versions", () => {
  const row = {
    id,
    identifier: "ENG-1",
    title: "First",
    version: 1,
    cycleId: null,
    status: { id, name: "Todo", category: "unstarted" },
    priority: "none",
    team: { id, name: "Engineering" },
    assignee: null,
    project: null,
    cycle: null,
    parent: null,
    labels: [],
    blocked: false,
    dueDate: null,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
    groupKey: "none",
  };
  const data = issueListSchema.parse({
    revision: "fixture-revision",
    issues: [row],
    total: 4,
    offset: 0,
    pageSize: 50,
    assignees: [],
    groups: [{ key: "none", name: "Unassigned", count: 4 }],
  });
  assert.equal(issueGroups(data, "assignee")[0].count, 4);
  const original = new Map();
  const selected = toggleIssueSelection(original, data.issues[0]);
  assert.equal(original.size, 0);
  assert.equal(selected.size, 1);
  assert.equal(
    refreshIssueSelection(selected, [{ ...data.issues[0], version: 2 }]).get(
      "ENG-1",
    )?.version,
    2,
  );
  assert.equal(toggleIssueSelection(selected, data.issues[0]).size, 0);
});
test("[SEARCH-001 CMD-001] the palette opens Search, which groups issues, projects and saved views", () => {
  const results = {
    issues: [],
    projects: [],
    savedViews: [{ id, name: "My urgent work", isShared: false }],
  };
  const search = (query: string) =>
    paletteEntries(results, query).find((entry) => entry.id === "command:search");
  assert.equal(
    paletteEntries(null, "").find((entry) => entry.id === "command:search")
      ?.destination,
    "/app/search",
  );
  assert.equal(search("search")?.destination, "/app/search");
  assert.equal(search("saved views")?.destination, "/app/search");
  assert.equal(search("urgent"), undefined);
});
