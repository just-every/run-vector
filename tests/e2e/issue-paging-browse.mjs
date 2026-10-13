import assert from "node:assert/strict";
import { auditBothWidths, settled } from "./ui-state-audit.mjs";
import {
  createPagingFixture,
  assertNoPageOverflow,
} from "./issue-paging-fixture.mjs";

export async function exercisePagedBrowse(context, fixture) {
  const rows = (await createPagingFixture(context, fixture)).filter(
    (row) => row.category !== "completed",
  );
  const { page, base, results } = context;
  assert.ok(rows.length > 150, "VIEW-001 fixture exceeds three default pages");
  for (const grouping of [
    "none",
    "status",
    "assignee",
    "priority",
    "project",
    "cycle",
    "team",
  ]) {
    await page.goto(
      `${base}/app/issues?q=Paging%20browser&grouping=${grouping}&sort=newest`,
    );
    await settled(page);
    const seen = [],
      keys = [];
    let metadata;
    for (let index = 0; ; index++) {
      const data = await fixture.api(
        "/api/issues" + new URL(page.url()).search,
      );
      assert.equal(data.total, rows.length, `VIEW-001 ${grouping} full count`);
      assert.equal(data.pageSize, 50, "VIEW-001 list default page stays fifty");
      assert.ok(
        data.allGroups,
        "VIEW-001 REST retains complete metadata separately",
      );
      if (!metadata) metadata = data.allGroups;
      assert.deepEqual(
        data.allGroups,
        metadata,
        "VIEW-001 global metadata remains stable across pages",
      );
      assert.equal(
        data.allGroups.reduce((sum, group) => sum + group.count, 0),
        data.total,
        "VIEW-001 complete group counts equal total",
      );
      const present = data.groups.filter((group) =>
        data.issues.some((row) => row.groupKey === group.key),
      );
      assert.equal(
        await page.locator(".issues-group h2").count(),
        grouping === "none" ? 0 : present.length,
        "VIEW-001 only groups with rows render headers",
      );
      assert.equal(
        await page
          .getByText("No issues in this group on this page.", { exact: true })
          .count(),
        0,
        "VIEW-001 no empty group placeholders",
      );
      assert.deepEqual(
        await page.locator(".issues-row .issues-identifier").allTextContents(),
        data.issues.map((row) => row.identifier),
        "VIEW-001 grouped SQL order reaches browser",
      );
      if (grouping !== "none")
        for (let groupIndex = 0; groupIndex < present.length; groupIndex++) {
          const group = present[groupIndex],
            count = data.issues.filter(
              (row) => row.groupKey === group.key,
            ).length;
          const heading = page.locator(".issues-group h2").nth(groupIndex);
          assert.ok(
            (await heading.textContent()).includes(`${group.count}`),
            "VIEW-001 header retains full group count",
          );
          if (count < group.count)
            assert.ok(
              (await heading.textContent()).includes(
                `Showing ${count} of ${group.count}`,
              ),
              "VIEW-001 spanning group count is explicit",
            );
        }
      seen.push(...data.issues.map((row) => row.identifier));
      keys.push(...data.issues.map((row) => row.groupKey));
      if (index < 3) {
        const start = results.length;
        await auditBothWidths(context, `issues-paged-${grouping}-${index + 1}`);
        results.slice(start).forEach(assertNoPageOverflow);
      }
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
      "VIEW-001 paging has no duplicate or omitted rows",
    );
    assert.deepEqual(
      [...seen].sort(),
      rows.map((row) => row.identifier).sort(),
      "VIEW-001 every filtered issue is reachable",
    );
    const rank = new Map(metadata.map((group, index) => [group.key, index]));
    for (let i = 1; i < keys.length; i++)
      assert.ok(
        rank.get(keys[i - 1]) <= rank.get(keys[i]),
        `VIEW-001 ${grouping} remains globally contiguous`,
      );
  }
  for (const sort of [
    "newest",
    "oldest",
    "priority",
    "status",
    "due",
    "updated",
  ]) {
    await page.goto(
      `${base}/app/issues?q=Paging%20browser&grouping=priority&sort=${sort}`,
    );
    await settled(page);
    const data = await fixture.api("/api/issues" + new URL(page.url()).search);
    assert.deepEqual(
      await page.locator(".issues-row .issues-identifier").allTextContents(),
      data.issues.map((row) => row.identifier),
      `VIEW-001 ${sort} grouped order`,
    );
    const start = results.length;
    await auditBothWidths(context, `issues-paged-sort-${sort}`);
    results.slice(start).forEach(assertNoPageOverflow);
  }
}
