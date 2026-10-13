import assert from "node:assert/strict";
import { auditBothWidths, settled } from "./ui-state-audit.mjs";
import {
  createPagingFixture,
  assertNoPageOverflow,
} from "./issue-paging-fixture.mjs";

export async function exercisePagedBoard(context, fixture) {
  const specimens = await createPagingFixture(context, fixture);
  const { page, base, results } = context;
  const team = fixture.opts.teams[0].id;
  const statuses = fixture.opts.statuses
    .filter((status) => status.teamId === team)
    .sort((a, b) => a.position - b.position);
  for (const category of ["all", "completed"]) {
    const rows = specimens.filter(
      (row) =>
        row.team === team &&
        (category === "all"
          ? row.category !== "completed"
          : row.category === category),
    );
    if (category === "all")
      assert.ok(rows.length > 100, "VIEW-005 fixture exceeds board page cap");
    // Nonstatus grouping must not change workflow totals.
    await page.goto(
      `${base}/app/board?q=Paging%20browser&team=${team}&category=${category}&grouping=priority&sort=oldest`,
    );
    await settled(page);
    const seen = [];
    for (let index = 0; ; index++) {
      assert.equal(
        new URL(page.url()).searchParams.get("pageSize"),
        "100",
        "VIEW-005 board cap is explicit in URL and API query",
      );
      const data = await fixture.api(
        "/api/issues" + new URL(page.url()).search,
      );
      assert.equal(
        data.pageSize,
        100,
        "VIEW-005 board fetches bounded hundred-row pages",
      );
      assert.equal(
        new URL(page.url()).searchParams.get("grouping"),
        "status",
        "VIEW-005 board grouping is explicitly workflow status",
      );
      assert.equal(data.total, rows.length, "VIEW-005 overall filtered count");
      assert.equal(
        await page
          .getByRole("navigation", { name: "Issue pages", exact: true })
          .count(),
        1,
        "VIEW-005 paging remains present even when disabled",
      );
      assert.equal(
        await page.locator(".board-column").count(),
        statuses.length,
        "VIEW-005 all workflow columns stay in workflow order",
      );
      for (let position = 0; position < statuses.length; position++) {
        const status = statuses[position],
          count = rows.filter((row) => row.status === status.id).length;
        const current = data.issues.filter(
          (row) => row.status.id === status.id,
        );
        const column = page.locator(".board-column").nth(position);
        assert.equal(
          data.statusCounts.find((group) => group.key === status.id)?.count ??
            0,
          count,
          "VIEW-005 SQL counts cover full result independently of grouping",
        );
        assert.equal(
          (await column.locator("h2").textContent())
            .replace(/\s+/g, " ")
            .trim(),
          `${status.name} ${count}`,
          "VIEW-005 heading shows true column count",
        );
        assert.ok(
          (await column.textContent()).includes(
            `Showing ${current.length} of ${count}`,
          ),
          "VIEW-005 column states fetched share clearly",
        );
        assert.deepEqual(
          await column.locator(".board-card-open small").allTextContents(),
          current.map((row) => row.identifier),
          "VIEW-005 cards preserve real SQL page order within each column",
        );
        await page.setViewportSize({ width: 390, height: 844 });
        const picker = page.getByLabel("Board column", { exact: true });
        assert.equal(
          await picker.locator(`option[value="${status.id}"]`).textContent(),
          `${status.name} (${count})`,
          "VIEW-005 mobile option uses true count",
        );
        await picker.selectOption(status.id);
        assert.equal(
          await page.locator(".board-column:visible").count(),
          1,
          "VIEW-005 one phone column",
        );
      }
      seen.push(...data.issues.map((row) => row.identifier));
      const start = results.length;
      await auditBothWidths(context, `board-paged-${category}-${index + 1}`);
      results.slice(start).forEach(assertNoPageOverflow);
      if (
        await page
          .getByRole("button", { name: "Next", exact: true })
          .isDisabled()
      )
        break;
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await settled(page);
    }
    assert.equal(
      new Set(seen).size,
      rows.length,
      "VIEW-005 no repeated cards across pages",
    );
    assert.deepEqual(
      [...seen].sort(),
      rows.map((row) => row.identifier).sort(),
      "VIEW-005 every filtered card reachable",
    );
  }
  const lexical = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const priorities = ["urgent", "high", "medium", "low", "none"];
  const orders = {
    newest: (a, b) => lexical(b.created, a.created),
    oldest: (a, b) => lexical(a.created, b.created),
    updated: (a, b) => lexical(b.updated, a.updated),
    priority: (a, b) =>
      priorities.indexOf(a.priority) - priorities.indexOf(b.priority),
    due: (a, b) => lexical(a.due ?? "9999", b.due ?? "9999"),
    status: () => 0,
  };
  const normal = specimens.filter(
    (row) => row.team === team && row.category !== "completed",
  );
  for (const [storedGrouping, sort] of [
    ...Object.keys(orders).map((sort) => ["assignee", sort]),
    ["project", "newest"],
  ]) {
    await page.goto(
      `${base}/app/board?q=Paging%20browser&team=${team}&grouping=${storedGrouping}&sort=${sort}`,
    );
    await settled(page);
    assert.equal(
      new URL(page.url()).searchParams.get("grouping"),
      "status",
      "VIEW-005 requested nonstatus grouping projects explicitly to workflow grouping",
    );
    assert.equal(
      await page.getByLabel("Group by", { exact: true }).inputValue(),
      "status",
      "VIEW-005 grouping control describes displayed workflow",
    );
    assert.equal(
      await page.getByLabel("Group by", { exact: true }).isDisabled(),
      true,
      "VIEW-005 board grouping is fixed with an explicit reason",
    );
    await page
      .getByText("Board groups by workflow status.", { exact: true })
      .waitFor();
    const shown = [];
    for (let index = 0; ; index++) {
      const data = await fixture.api(
        "/api/issues" + new URL(page.url()).search,
      );
      shown.push(...data.issues);
      for (let position = 0; position < statuses.length; position++)
        assert.deepEqual(
          await page
            .locator(".board-column")
            .nth(position)
            .locator(".board-card-open small")
            .allTextContents(),
          data.issues
            .filter((row) => row.status.id === statuses[position].id)
            .map((row) => row.identifier),
          `VIEW-005 ${sort} SQL card order on page`,
        );
      const start = results.length;
      await auditBothWidths(
        context,
        `board-paged-sort-${storedGrouping}-${sort}-${index + 1}`,
      );
      results.slice(start).forEach(assertNoPageOverflow);
      if (
        await page
          .getByRole("button", { name: "Next", exact: true })
          .isDisabled()
      )
        break;
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await settled(page);
    }
    assert.equal(
      new Set(shown.map((row) => row.identifier)).size,
      normal.length,
      "VIEW-005 all sorted cards reached without duplicate or omission",
    );
    for (const status of statuses) {
      const expected = normal
        .filter((row) => row.status === status.id)
        .sort(
          (a, b) => orders[sort](a, b) || lexical(a.identifier, b.identifier),
        );
      assert.deepEqual(
        shown
          .filter((row) => row.status.id === status.id)
          .map((row) => row.identifier),
        expected.map((row) => row.identifier),
        `VIEW-005 ${sort} column globally ordered across every page`,
      );
    }
  }
  const done = statuses.find((status) => status.category === "completed");
  await page.goto(
    `${base}/app/board?q=Paging%20browser&team=${team}&status=${done.id}`,
  );
  await settled(page);
  const exact = await fixture.api("/api/issues" + new URL(page.url()).search);
  assert.ok(
    exact.total > 0,
    "VIEW-005 explicit completed status remains visible",
  );
  assert.equal(
    exact.statusCounts.find((group) => group.key === done.id)?.count,
    exact.total,
    "VIEW-005 explicit completed status true count",
  );
  await auditBothWidths(context, "board-paged-exact-completed");
}
