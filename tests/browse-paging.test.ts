import assert from "node:assert/strict";
import { test } from "node:test";
import {
  issueListQuerySchema,
  issueListSchema,
} from "../src/core/features/issues/list-schema.ts";
import { issueGroups } from "../src/core/features/issues/ui/issue-selection.ts";

const row = {
  id: "1",
  identifier: "PGP-1",
  title: "Paged group",
  version: 1,
  cycleId: null,
  status: { id: "todo", name: "Todo", category: "unstarted" },
  priority: "none",
  team: { id: "t", name: "Team" },
  assignee: null,
  project: null,
  cycle: null,
  parent: null,
  labels: [],
  blocked: false,
  dueDate: null,
  createdAt: "2026-10-09",
  updatedAt: "2026-10-09",
  groupKey: "todo",
};
test("[VIEW-001] rendered groups contain rows while retaining full-result counts for a spanning group", () => {
  const data = issueListSchema.parse({
    revision: "fixture-revision",
    issues: [row],
    total: 151,
    offset: 50,
    pageSize: 50,
    assignees: [],
    groups: [
      { key: "backlog", name: "Backlog", count: 51 },
      { key: "todo", name: "Todo", count: 100 },
    ],
  });
  assert.deepEqual(
    issueGroups(data, "status").map((group) => [
      group.key,
      group.count,
      group.issues.length,
    ]),
    [["todo", 100, 1]],
  );
  assert.deepEqual(issueGroups({ ...data, issues: [] }, "status"), []);
  assert.equal(data.groups.length, 2, "global service metadata is unchanged");
});
test("[VIEW-001 VIEW-005] list defaults stay at fifty; explicit board-sized pages are validated and bounded", () => {
  assert.equal(issueListQuerySchema.parse({}).pageSize, 50);
  assert.equal(issueListQuerySchema.parse({ pageSize: "100" }).pageSize, 100);
  for (const pageSize of [0, 51, 101, 200, 100000, "bad"])
    assert.equal(issueListQuerySchema.safeParse({ pageSize }).success, false);
});
