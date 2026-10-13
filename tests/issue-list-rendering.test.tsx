import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/core/app/api-client";
import { IssueListView } from "../src/core/features/issues/ui/issues-browser";
import { defaultIssueListQuery } from "../src/core/features/issues/ui/issue-list-controls";
import type { IssueListData } from "../src/core/features/issues/list-schema";
const data: IssueListData = {
    revision: "fixture-revision",
  total: 1,
  offset: 0,
  pageSize: 50,
  assignees: [{ id: "private-actor", name: "Private operator" }],
  groups: [{ key: "all", name: "Issues", count: 1 }],
  issues: [
    {
      version: 1,
      cycleId: null,
      project: null,
      cycle: null,
      parent: null,
      labels: [],
      blocked: false,
      dueDate: null,
      createdAt: "2026-10-02",
      groupKey: "all",
      id: "1",
      identifier: "VT-101",
      title: "Browse ordinary backlog",
      status: { id: "s", name: "Planned", category: "backlog" },
      priority: "high",
      assignee: null,
      team: { id: "t", name: "Flow" },
      updatedAt: "2026-10-02",
    },
  ],
};
const render = (changes: Partial<Parameters<typeof IssueListView>[0]> = {}) =>
  renderToStaticMarkup(
    <IssueListView
      query={defaultIssueListQuery}
      data={data}
      loading={false}
      error={null}
      reload={() => {}}
      onChange={() => {}}
      onOpen={() => {}}
      {...changes}
    />,
  );
describe("ordinary issue browse states", () => {
  it("renders actual status, team, priority, unassigned and keyboard-focusable detail action", () => {
    const html = render();
    for (const value of [
      "Planned",
      "Flow",
      "High",
      "Unassigned",
      'id="issue-row-VT-101"',
      "Browse ordinary backlog",
    ])
      expect(html).toContain(value);
    expect(html).toContain("Completed issues are hidden");
  });
  it("shows initial loading without fabricated rows", () => {
    const html = render({ data: null, loading: true });
    expect(html).toContain('role="status"');
    expect(html).not.toContain("VT-101");
  });
  it("shows empty backlog and a new issue path", () => {
    const html = render({
      query: { ...defaultIssueListQuery, category: "backlog" },
      data: { ...data, total: 0, issues: [] },
    });
    expect(html).toContain("Backlog is empty");
    expect(html).toContain('href="/app/new"');
    expect(html).not.toContain("VT-101");
  });
  it("offers reset for filtered emptiness or an exhausted page", () => {
    const html = render({
      query: { ...defaultIssueListQuery, q: "missing", offset: 50 },
      data: { ...data, issues: [] },
    });
    expect(html).toContain("No issues on this page");
    expect(html).toContain("Reset filters and page");
  });
  it("retains explicitly labelled last loaded rows during transient error and refresh", () => {
    const html = render({ error: new Error("offline"), loading: true });
    expect(html).toContain("Last loaded issues are shown");
    expect(html).toContain("Refreshing issues");
    expect(html).toContain("Retry");
    expect(html).toContain("VT-101");
  });
  it.each([401, 403, 404, 410])(
    "clears private rows and operator names after denial %s",
    (status) => {
      const html = render({
        error: new ApiError(status, { message: "denied" }),
      });
      expect(html).not.toContain("VT-101");
      expect(html).not.toContain("Private operator");
      expect(html).toContain("Sign in again");
    },
  );
});
