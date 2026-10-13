import assert from "node:assert/strict";
import { auditBothWidths, settled } from "./ui-state-audit.mjs";
import { assertNoPageOverflow } from "./issue-paging-fixture.mjs";

const queryText = "Concentrated board";
const categories = [
  "backlog",
  "started",
  "intake",
  "unstarted",
  "completed",
  "canceled",
  "duplicate",
];
const priorities = ["urgent", "high", "medium", "low", "none"];
const quote = (value) =>
  value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const lexical = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const orders = {
  newest: (a, b) => lexical(b.created, a.created),
  oldest: (a, b) => lexical(a.created, b.created),
  updated: (a, b) => lexical(b.updated, a.updated),
  priority: (a, b) => priorities.indexOf(a.priority) - priorities.indexOf(b.priority),
  due: (a, b) => lexical(a.due ?? "9999", b.due ?? "9999"),
  status: (a, b) => a.position - b.position,
};

function createConcentratedRows(team, statuses) {
  const byCategory = new Map(statuses.map((status) => [status.category, status]));
  const distribution = [
    ["backlog", 135],
    ...categories.slice(1).map((category) => [category, 3]),
  ];
  let sequence = 0;
  return distribution.flatMap(([category, count]) => {
    const status = byCategory.get(category);
    assert.ok(status, `VIEW-005 fixture has ${category} workflow status`);
    return Array.from({ length: count }, () => {
      const index = sequence++;
      const day = String(1 + ((index * 11) % 28)).padStart(2, "0");
      const hour = String((index * 7) % 24).padStart(2, "0");
      return {
        id: `01KX${String(index + 1).padStart(22, "0")}`,
        identifier: `CBR-${index + 1}`,
        team: team.id,
        status: status.id,
        category,
        position: status.position,
        priority: priorities[index % priorities.length],
        due: index % 4 === 0 ? null : `2026-10-${String(1 + ((index * 5) % 28)).padStart(2, "0")}`,
        created: `2026-09-${day}T${hour}:00:00Z`,
        updated: `2026-10-${day}T${String((index * 13) % 24).padStart(2, "0")}:00:00Z`,
      };
    });
  });
}

async function addConcentratedRows(context, rows) {
  await context.runtime.writeFixture(
    rows
      .map(
        (row, index) =>
          `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,due_date,created_at,updated_at) VALUES(${[
            row.id,
            row.identifier,
            "CBR",
            index + 1,
            row.team,
            `${queryText} item ${index + 1}`,
            row.status,
            row.priority,
            row.due,
            row.created,
            row.updated,
          ].map(quote).join(",")});`,
      ),
  );
}

function expectedStatusCounts(rows, statuses) {
  return new Map(
    statuses.map((status) => [
      status.id,
      rows.filter((row) => row.status === status.id).length,
    ]),
  );
}

async function readBoardPage(context, fixture, statuses, rows, offset, sort) {
  const { page } = context;
  const { api } = fixture;
  const data = await api("/api/issues" + new URL(page.url()).search);
  assert.equal(data.pageSize, 100, "VIEW-005 board fetches bounded hundred-row pages");
  assert.equal(data.offset, offset, "VIEW-005 API offset matches current page");
  assert.equal(data.total, rows.length, "VIEW-005 full filtered board count");
  assert.equal(data.issues.length, Math.min(100, rows.length - offset));
  assert.equal(data.pageSize, 100);
  assert.deepEqual(
    new Map(data.statusCounts.map(({ key, count }) => [key, count])),
    new Map(
      [...expectedStatusCounts(rows, statuses)].filter(([, count]) => count > 0),
    ),
    "VIEW-005 SQL status counts cover the entire filtered result on every page",
  );
  assert.equal(
    new URL(page.url()).searchParams.get("grouping"),
    "status",
    "VIEW-005 board grouping remains workflow status",
  );
  assert.equal(
    new URL(page.url()).searchParams.get("sort") ?? "newest",
    sort,
    "VIEW-005 selected board sort remains semantically intact in the route",
  );
  assert.equal(await page.locator(".board-column").count(), statuses.length);
  for (let index = 0; index < statuses.length; index++) {
    const status = statuses[index];
    const count = expectedStatusCounts(rows, statuses).get(status.id);
    const current = data.issues.filter((row) => row.status.id === status.id);
    const column = page.locator(".board-column").nth(index);
    assert.equal(
      (await column.locator("h2").textContent()).replace(/\s+/g, " ").trim(),
      `${status.name} ${count}`,
      "VIEW-005 heading reports SQL count for full status column",
    );
    assert.ok(
      (await column.locator("p").first().textContent()).includes(
        `Showing ${current.length} of ${count}`,
      ),
      "VIEW-005 column reports the current page share",
    );
    assert.deepEqual(
      await column.locator(".board-card-open small").allTextContents(),
      current.map((row) => row.identifier),
      `VIEW-005 ${sort} cards match the current API page in ${status.name}`,
    );
  }
  return data;
}

async function inspectMobileColumns(page, statuses, data, rows) {
  const picker = page.getByLabel("Board column", { exact: true });
  const statusCounts = expectedStatusCounts(rows, statuses);
  for (const status of statuses) {
    const count = statusCounts.get(status.id);
    assert.equal(
      await picker.locator(`option[value="${status.id}"]`).textContent(),
      `${status.name} (${count})`,
      "VIEW-005 mobile picker reports the full filtered SQL count",
    );
    await picker.selectOption(status.id);
    const visible = page.locator(".board-column:visible");
    assert.equal(await visible.count(), 1, "VIEW-005 mobile exposes one selected column");
    assert.equal(
      (await visible.locator("h2").textContent()).replace(/\s+/g, " ").trim(),
      `${status.name} ${count}`,
    );
    const current = data.issues.filter((row) => row.status.id === status.id);
    assert.ok(
      (await visible.locator("p").first().textContent()).includes(
        `Showing ${current.length} of ${count}`,
      ),
      "VIEW-005 mobile column reports the current page share",
    );
    assert.deepEqual(
      await visible.locator(".board-card-open small").allTextContents(),
      current.map((row) => row.identifier),
      `VIEW-005 mobile ${status.name} cards match the selected sort and page`,
    );
  }
}

async function auditConcentratedPage(context, name) {
  const start = context.results.length;
  await auditBothWidths(context, name);
  context.results.slice(start).forEach(assertNoPageOverflow);
}

export async function exerciseConcentratedBoard(context, fixture) {
  if (!fixture.concentratedBoard) {
    const team = fixture.opts.teams[0];
    const statuses = fixture.opts.statuses
      .filter((status) => status.teamId === team.id)
      .sort((a, b) => a.position - b.position);
    const allRows = createConcentratedRows(team, statuses);
    await addConcentratedRows(context, allRows);
    fixture.concentratedBoard = { team, statuses, allRows };
  }

  const { page, base } = context;
  const { team, statuses, allRows } = fixture.concentratedBoard;
  const rows = allRows.filter((row) => row.category !== "completed");
  assert.equal(
    rows.filter((row) => row.category === "backlog").length,
    135,
    "VIEW-005 concentrated fixture has more than one hundred cards in one status",
  );
  assert.ok(rows.length > 100, "VIEW-005 concentrated fixture crosses the board cap");

  for (const sort of ["newest", "oldest", "updated", "priority", "due", "status"]) {
    await page.goto(
      `${base}/app/board?q=${encodeURIComponent(queryText)}&team=${team.id}&sort=${sort}`,
    );
    await settled(page);
    assert.equal(await page.getByLabel("Sort", { exact: true }).inputValue(), sort);
    assert.equal(await page.getByLabel("Group by", { exact: true }).inputValue(), "status");

    const seen = [];
    let firstPage;
    for (let pageNumber = 0; pageNumber < 2; pageNumber++) {
      const offset = pageNumber * 100;
      assert.equal(
        Number(new URL(page.url()).searchParams.get("offset") ?? "0"),
        offset,
        "VIEW-005 URL offset identifies the current concentrated board page",
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      const data = await readBoardPage(context, fixture, statuses, rows, offset, sort);
      if (pageNumber === 0) firstPage = data;
      seen.push(...data.issues);

      await page.setViewportSize({ width: 390, height: 844 });
      await inspectMobileColumns(page, statuses, data, rows);
      await page.getByLabel("Board column", { exact: true }).selectOption(
        statuses.find((status) => status.category === "backlog").id,
      );
      await auditConcentratedPage(context, `board-concentrated-${sort}-page-${pageNumber + 1}`);

      const next = page.getByRole("button", { name: "Next", exact: true });
      const previous = page.getByRole("button", { name: "Previous", exact: true });
      assert.equal(await previous.isDisabled(), pageNumber === 0);
      assert.equal(await next.isDisabled(), pageNumber === 1);
      if (pageNumber === 0) {
        await next.click();
        await settled(page);
      }
    }

    assert.equal(
      new Set(seen.map((row) => row.identifier)).size,
      rows.length,
      "VIEW-005 every concentrated board card appears once across pages",
    );
    assert.deepEqual(
      [...seen.map((row) => row.identifier)].sort(),
      rows.map((row) => row.identifier).sort(),
      "VIEW-005 all filtered concentrated board cards are reachable",
    );
    for (const status of statuses) {
      const expected = rows
        .filter((row) => row.status === status.id)
        .sort((a, b) => orders[sort](a, b) || lexical(a.identifier, b.identifier));
      assert.deepEqual(
        seen
          .filter((row) => row.status.id === status.id)
          .map((row) => row.identifier),
        expected.map((row) => row.identifier),
        `VIEW-005 ${sort} order is stable within ${status.name} across all pages`,
      );
    }
    assert.equal(firstPage.issues.filter((row) => row.status.id === statuses.find((s) => s.category === "backlog").id).length +
      seen.slice(firstPage.issues.length).filter((row) => row.status.id === statuses.find((s) => s.category === "backlog").id).length,
      135,
      "VIEW-005 concentrated status spans the board page boundary",
    );

    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await settled(page);
    assert.deepEqual(
      (await fixture.api("/api/issues" + new URL(page.url()).search)).issues.map((row) => row.identifier),
      firstPage.issues.map((row) => row.identifier),
      "VIEW-005 Previous returns to the prior concentrated page",
    );
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await settled(page);
    assert.equal(Number(new URL(page.url()).searchParams.get("offset")), 100);
  }

  const completed = statuses.find((status) => status.category === "completed");
  await page.goto(
    `${base}/app/board?q=${encodeURIComponent(queryText)}&team=${team.id}&status=${completed.id}`,
  );
  await settled(page);
  const completedData = await fixture.api("/api/issues" + new URL(page.url()).search);
  const completedRows = allRows.filter((row) => row.category === "completed");
  assert.equal(completedData.total, completedRows.length);
  assert.deepEqual(
    completedData.statusCounts.map(({ key, count }) => [key, count]),
    [[completed.id, completedRows.length]],
    "VIEW-005 explicit completed filter retains its full SQL status count",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await inspectMobileColumns(page, statuses, completedData, completedRows);
  await page.getByLabel("Board column", { exact: true }).selectOption(completed.id);
  await auditConcentratedPage(context, "board-concentrated-explicit-completed");
}
