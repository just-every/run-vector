import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApiError,
  createApiResourceController,
  resourceStateForIdentity,
  type ResourceState,
} from "../src/core/app/api-client.ts";
import {
  issueListQuerySchema,
  issueListSchema,
  type IssueListData,
} from "../src/core/features/issues/list-schema.ts";
import {
  changeIssueListFilters,
  defaultIssueListQuery,
  issueListApiUrl,
  issueListReturnPath,
} from "../src/core/features/issues/ui/issue-list-controls.ts";

test("[VIEW-001] filters reset pagination, page changes preserve filters and detail returns retain exact browsing state", () => {
  const query = issueListQuerySchema.parse({
    q: "issue & unicode ✓",
    category: "backlog",
    assignee: "unassigned",
    offset: 50,
  });
  const url = issueListReturnPath(query);
  assert.equal(url.startsWith("/app/issues?"), true);
  assert.deepEqual(
    issueListQuerySchema.parse(
      Object.fromEntries(new URL(url, "http://local").searchParams),
    ),
    query,
  );
  assert.equal(
    issueListApiUrl(query),
    url.replace("/app/issues", "/api/issues"),
  );
  assert.equal(changeIssueListFilters(query, { q: "new" }).offset, 0);
  assert.deepEqual(changeIssueListFilters(query, { offset: 100 }), {
    ...query,
    offset: 100,
  });
  assert.equal(issueListReturnPath(defaultIssueListQuery), "/app/issues");
});
test("[VIEW-001 BASE-ACCESS-001] late filtered receipts and late denial never overwrite the newer list; denial clears all private rows and choices", async () => {
  const blank: IssueListData = {
    revision: "fixture-revision",
    issues: [],
    assignees: [],
    total: 0,
    offset: 0,
    pageSize: 50,
  };
  let firstResolve!: (data: IssueListData) => void,
    secondResolve!: (data: IssueListData) => void;
  const calls: Array<(signal: AbortSignal) => Promise<IssueListData>> = [
    () => new Promise((resolve) => (firstResolve = resolve)),
    () => new Promise((resolve) => (secondResolve = resolve)),
    () => Promise.reject(new ApiError(401, {})),
  ];
  const receipts: ResourceState<IssueListData>[] = [];
  const controller = createApiResourceController<IssueListData>(
    (signal) => calls.shift()!(signal),
    (state) => receipts.push(state),
  );
  const older = controller.refresh(),
    newer = controller.refresh();
  secondResolve(blank);
  await newer;
  firstResolve({
    ...blank,
    total: 1,
    assignees: [{ id: "private", name: "Private older operator" }],
  });
  await older;
  assert.deepEqual(receipts.at(-1)?.data, blank);
  await controller.refresh();
  assert.equal(receipts.at(-1)?.data, null);
  assert.equal(receipts.at(-1)?.error instanceof ApiError, true);
  const snapshot = {
    ...receipts.at(-1)!,
    url: "/api/issues?q=old",
    schema: issueListSchema,
  };
  assert.deepEqual(
    resourceStateForIdentity(snapshot, "/api/issues?q=new", issueListSchema),
    { data: null, error: null, loading: true },
  );
  controller.dispose();
});
