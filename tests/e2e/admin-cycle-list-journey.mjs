// Settle native polling before replacing an authorized private document.
import {
  beforePrivateNavigation,
  settleReads,
} from "./collaboration-navigation.mjs";
import assert from "node:assert/strict";
import { poll } from "./admin-runtime-support.mjs";
export async function exerciseCycleList({
  page,
  runtime,
  capture,
  clause,
  issue,
  cycles,
}) {
  const { base, sql } = runtime;
  await clause(
    "CYCLE-002",
    "cycle list commits moves and uncommits existing issue",
    async () => {
      await beforePrivateNavigation(page, base + "/app/cycles/" + cycles[0].id);
      await page.goto(base + "/app/cycles/" + cycles[0].id);
      await page
        .getByRole("heading", { name: cycles[0].name, exact: true })
        .waitFor();
      const form = page.getByRole("form", {
        name: "Commit issue to cycle",
        exact: true,
      });
      // Typing replaces the picker's first read; let that read finish first.
      await settleReads(page);
      await form
        .getByLabel("Issue identifier", { exact: true })
        .fill(issue.identifier);
      const before = sql(`SELECT version FROM issues WHERE id='${issue.id}'`)[0]
        .version;
      await form
        .getByRole("button", { name: "Commit issue", exact: true })
        .click();
      await poll(
        () => sql(`SELECT cycle_id,version FROM issues WHERE id='${issue.id}'`),
        (rows) =>
          rows[0]?.cycle_id === cycles[0].id && rows[0].version === before + 1,
        "list commit",
      );
      await page
        .getByRole("group", {
          name: "Cycle issue " + issue.identifier,
          exact: true,
        })
        .waitFor();
      await capture("cycle-list-committed");
      await page
        .getByRole("combobox", {
          name: "Cycle commitment for " + issue.identifier,
          exact: true,
        })
        .selectOption(cycles[1].id);
      await poll(
        () => sql(`SELECT cycle_id,version FROM issues WHERE id='${issue.id}'`),
        (rows) =>
          rows[0]?.cycle_id === cycles[1].id && rows[0].version === before + 2,
        "list move",
      );
      await page
        .getByRole("group", {
          name: "Cycle issue " + issue.identifier,
          exact: true,
        })
        .waitFor({ state: "hidden" });
      await capture("cycle-list-moved-source-empty");

      await beforePrivateNavigation(page, base + "/app/cycles/" + cycles[1].id);
      await page.goto(base + "/app/cycles/" + cycles[1].id);
      await page
        .getByRole("combobox", {
          name: "Cycle commitment for " + issue.identifier,
          exact: true,
        })
        .waitFor();
      await capture("cycle-list-moved-destination");
      await page
        .getByRole("combobox", {
          name: "Cycle commitment for " + issue.identifier,
          exact: true,
        })
        .selectOption("");
      await poll(
        () => sql(`SELECT cycle_id,version FROM issues WHERE id='${issue.id}'`),
        (rows) => rows[0]?.cycle_id === null && rows[0].version === before + 3,
        "list uncommit",
      );
      await page
        .getByRole("group", {
          name: "Cycle issue " + issue.identifier,
          exact: true,
        })
        .waitFor({ state: "hidden" });
      await capture("cycle-list-uncommitted");
      const history = sql(
        `SELECT * FROM issue_activity WHERE issue_id='${issue.id}' AND kind='issue.updated'`,
      );
      for (const id of cycles.map((c) => c.id))
        assert.ok(
          history.some((row) => (row.previous_value_json ?? "").includes(id)) &&
            history.some((row) => (row.next_value_json ?? "").includes(id)),
          "both cycle IDs retained in history",
        );
    },
  );
}
