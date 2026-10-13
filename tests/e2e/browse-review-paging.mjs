import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { settled, auditState } from "./ui-state-audit.mjs";
import { savedViewHeldResponses } from "./saved-view-held-responses.mjs";
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
export async function pagingRestart(context, fixture) {
  const { page, base, runtime } = context;
  await runtime.writeFixture(
    Array.from(
      { length: 111 },
      (_, i) =>
        `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,created_at,updated_at) VALUES('01J8${String(i + 1).padStart(22, "0")}','RPG-${i + 1}','RPG',${i + 1},${quote(fixture.team.id)},'Restart traversal',${quote(fixture.backlog.id)},'none','2026-10-01','2026-10-01');`,
    ),
  );
  for (const layout of ["list", "board", "view"]) {
    const view =
      layout === "view"
        ? await fixture.api(
            "/api/views",
            "POST",
            {
              name: "Restart saved view",
              query: {
                q: "Restart traversal",
                sort: "priority",
                team: fixture.team.id,
              },
              layout: "list",
              isShared: false,
            },
            201,
          )
        : null;
    const path = view
      ? `/app/views/${view.id}`
      : `/app/${layout === "list" ? "issues" : "board"}?q=Restart%20traversal&sort=priority&team=${fixture.team.id}`;
    const readiness = view ? { search: new URLSearchParams({
      q: view.query.q, sort: view.query.sort, team: view.query.team,
    }).toString() } : undefined;
    const viewPreferences = view ? await Promise.all([
      fixture.api("/api/preferences/issues"), fixture.api("/api/preferences/board"),
    ]) : null;
    await page.goto(base + path);
    await settled(page, readiness);
    if (!view) {
      // Rendering finishes before StoredIssueControls saves the initial URL.
      // Take the baseline only after those exact controls reach native storage.
      await expect.poll(
        () => fixture.api(`/api/preferences/${layout === "board" ? "board" : "issues"}`),
        { message: "initial URL controls persist before pagination", timeout: 15000 },
      ).toEqual({
        surface: layout === "board" ? "board" : "issues",
        filters: {
          q: "Restart traversal", category: "all", status: "all", priority: "all",
          assignee: "all", team: fixture.team.id, project: "all", cycle: "all",
          label: "all", due: "all", dueFrom: "", dueTo: "", blocked: "all",
          parent: "all", pageSize: 50,
        },
        sort: "priority", grouping: "none",
      });
    }
    const oldPreference = await fixture.api(
      `/api/preferences/${layout === "board" ? "board" : "issues"}`,
    );
    const shownSearch = await page.locator("main[data-list-query]").getAttribute("data-list-query");
    const firstPage = await fixture.api("/api/issues" + shownSearch);
    assert.equal(firstPage.offset, 0);
    assert.equal(firstPage.total, 111);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    // Pause the intended continuation at browser interception, before its
    // genuine Worker fetch. First-page reads and polls keep their own delivery.
    const transport = savedViewHeldResponses(page);
    try {
      const hold = await transport.hold("/api/issues", "GET", {
        beforeFetch: true,
        matchQuery: query => Number(query.get("offset")) === firstPage.pageSize && query.get("revision") === firstPage.revision,
      });
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await transport.ready(() => hold.entries.length > 0, "the intended continuation enters before mutation");
      assert.equal(Number(hold.entries[0].get("offset")), firstPage.pageSize);
      assert.equal(hold.entries[0].get("revision"), firstPage.revision);
      const target = await fixture.api("/api/issues/RPG-99");
      await fixture.api("/api/issues/RPG-99", "PATCH", {
        expectedVersion: target.version,
        priority: layout === "board" ? "high" : "urgent",
      });
      await transport.retire(hold);
      assert.ok(hold.rows.some(row => row.status === 409 && row.body.error === "pagination_invalidated"), "the genuine continuation refuses the invalidated revision");
      await page
        .getByText(
          "Issues changed. Pagination restarted from the first page.",
          { exact: true },
        )
        .waitFor();
      await settled(page, readiness);
      const query = new URLSearchParams(
        await page
          .locator("main[data-list-query]")
          .getAttribute("data-list-query"),
      );
      assert.equal(Number(query.get("offset") ?? 0), 0);
      assert.equal(
        query.get("revision"),
        null,
        "restarted first page requests fresh identity",
      );
      await expect(
        page.getByRole("button", { name: "Previous", exact: true }),
      ).toBeDisabled();
      assert.deepEqual(
        await fixture.api(
          `/api/preferences/${layout === "board" ? "board" : "issues"}`,
        ),
        oldPreference,
        "revision never alters stored controls",
      );
      if (view) {
        const stored = await fixture.api(`/api/views/${view.id}`);
        assert.equal(stored.query.revision, "");
        assert.equal(stored.query.offset, 0);
        assert.deepEqual(await Promise.all([
          fixture.api("/api/preferences/issues"), fixture.api("/api/preferences/board"),
        ]), viewPreferences, "saved-view browsing never writes ordinary controls");
      }
      assert.equal((await fixture.api("/api/issues/RPG-99")).priority, layout === "board" ? "high" : "urgent");
      await auditState(context, `${layout}-pagination-restarted`);
    } finally {
      assert.deepEqual((await transport.close()).errors, []);
    }
  }
}
export async function scheduledCustody(context, fixture) {
  const { runtime } = context;
  // Settled absent objects are complete; unsettled absence must remain charged.
  await runtime.writeFixture(`INSERT INTO detached_file_removals(id,issue_id,identifier,actor_operator_id,blob_key,bytes,writer_settled,removal_requested_at,updated_at) VALUES
    ('scheduled-ready','deleted-parent','GONE-1',${quote(fixture.opts.operator.id)},'scheduled-ready-key',5,1,'now','now'),
    ('scheduled-writer','deleted-parent','GONE-1',${quote(fixture.opts.operator.id)},'scheduled-writer-key',7,0,'now','now');`);
  const response = await runtime.req("/cdn-cgi/local/scheduled");
  assert.equal(response.status, 200);
  assert.ok(
    runtime.sql(
      "SELECT removal_confirmed_at FROM detached_file_removals WHERE id='scheduled-ready'",
    )[0].removal_confirmed_at,
  );
  const pending = runtime.sql(
    "SELECT removal_confirmed_at,writer_settled,bytes FROM detached_file_removals WHERE id='scheduled-writer'",
  )[0];
  assert.equal(pending.removal_confirmed_at, null);
  assert.equal(pending.writer_settled, 0);
  assert.equal(pending.bytes, 7);
}
export async function boardMoveAcrossPage(context, fixture) {
  const { page, base } = context;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `${base}/app/board?q=Restart%20traversal&sort=priority&team=${fixture.team.id}`,
  );
  await settled(page);
  await page
    .getByLabel("Board column", { exact: true })
    .selectOption(fixture.backlog.id);
  const selector = page.getByLabel("Status for RPG-1", { exact: true });
  await selector.focus();
  await page.keyboard.type(fixture.todo.name);
  const notice = page.getByRole("alert").filter({ hasText: "RPG-1" });
  await expect(notice).toContainText("outside the current page or filters");
  await expect(
    notice.getByRole("button", { name: "Open issue", exact: true }),
  ).toBeFocused();
  assert.equal(
    await page.getByLabel("Board column", { exact: true }).inputValue(),
    fixture.todo.id,
  );
  assert.equal(
    (await fixture.api("/api/issues/RPG-1")).status.id,
    fixture.todo.id,
  );
  assert.equal(await selector.count(), 0);
  await auditState(context, "moved-card-outside-page");
  await notice.getByRole("button", { name: "Open issue", exact: true }).click();
  await expect(page.locator(".issue-inspector")).toBeVisible();
}
export async function staleBoardRestart(context, fixture) {
  const { page, base } = context;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `${base}/app/board?q=Restart%20traversal&sort=priority&team=${fixture.team.id}`,
  );
  await settled(page);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await settled(page);
  const data = await fixture.api("/api/issues" + new URL(page.url()).search);
  const row = data.issues.find((row) => row.status.id === fixture.backlog.id);
  assert.ok(row);
  const changed = await fixture.api(`/api/issues/${row.identifier}`, "PATCH", {
    expectedVersion: row.version,
    priority: "low",
  });
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === `/api/issues/${row.identifier}` &&
      r.request().method() === "PATCH",
  );
  await page
    .getByLabel(`Status for ${row.identifier}`, { exact: true })
    .selectOption(fixture.todo.id);
  assert.equal((await response).status(), 409);
  await page
    .getByText("Issues changed. Pagination restarted from the first page.", {
      exact: true,
    })
    .waitFor();
  await settled(page);
  await expect(
    page.getByRole("alert").filter({ hasText: row.identifier }),
  ).toContainText("changed elsewhere");
  const persisted = await fixture.api(`/api/issues/${row.identifier}`);
  assert.equal(persisted.version, changed.version);
  assert.equal(persisted.status.id, fixture.backlog.id);
  await auditState(context, "stale-board-restart-notice");
}
