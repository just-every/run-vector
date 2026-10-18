import { expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { env } from "cloudflare:workers";
import { setupImport } from "./data-import-fixture";
import type { ImportInput } from "../../src/core/features/data/import/types";
const encode = (s: string) => Buffer.from(s).toString("base64");
async function fixture(prefix: string) {
  const f = await setupImport();
  const state = await f.mutate("/settings/teams", "POST", {
    name: "Rank import " + prefix,
    identifierPrefix: prefix,
  });
  const team = state.teams.find((t) => t.identifierPrefix === prefix)!,
    status = team.statuses.find((s) => s.category === "backlog")!;
  const list = async () => {
    const r = await f.call(`/issues?team=${team.id}&sort=manual`);
    expect(r.status).toBe(200);
    return (
      (await r.json()) as { issues: { identifier: string; title: string }[] }
    ).issues;
  };
  return { ...f, team, status, list };
}
it("[VIEW-006 DATA-010] Jira rank imports independently of source row order, repeats exactly and rolls back without retained positions", async () => {
  const f = await fixture("RJI");
  const csv =
    "Issue id,Issue key,Summary,Status,Rank\n1,OLD-1,Third in Jira,Backlog,0|i00003:\n2,OLD-2,First in Jira,Backlog,0|i00001:\n3,OLD-3,Second in Jira,Backlog,0|i00002:\n";
  const input: ImportInput = {
    format: "jira-csv",
    source: "ordered-jira",
    name: "jira.csv",
    base64: encode(csv),
    mapping: {},
    defaults: { team: f.team.id },
    references: { status: { Backlog: f.status.id } },
  };
  const preview = await f.preview(input);
  expect(preview.errors).toEqual([]);
  expect(
    preview.jiraReview?.concepts
      .find((c) => c.name === "rank")
      ?.occurrences.every((o) => o.action === "planned"),
  ).toBe(true);
  const run = await f.publish(input);
  expect((await f.list()).map((i) => i.title)).toEqual([
    "First in Jira",
    "Second in Jira",
    "Third in Jira",
  ]);
  const repeat = await f.preview(input);
  expect(repeat.errors).toEqual([]);
  expect(repeat.measured.reused).toBe(3);
  const again = await f.publish(input);
  expect(again.state).toBe("completed");
  expect(await f.list()).toHaveLength(3);
  const rollback = await f.call(
    "/data/import/runs/" + run.id + "/rollback",
    "POST",
    { confirmed: true },
  );
  expect(rollback.status, await rollback.clone().text()).toBe(200);
  expect(await f.list()).toEqual([]);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM manual_order_entries WHERE scope_key=?",
    )
      .bind("team:" + f.team.id)
      .first("n"),
  ).toBe(0);
  const ambiguous = {
    ...input,
    source: "ambiguous-jira",
    base64: encode(
      csv
        .replace("Status,Rank", "Status,Rank,Rank")
        .replaceAll(":\n", ":,0|i00004:\n"),
    ),
  };
  expect(
    (await f.preview(ambiguous)).errors.some(
      (e) => e.code === "ambiguous_rank",
    ),
  ).toBe(true);
});
it("[VIEW-006 DATA-008 DATA-004] Linear numeric order and legacy no-order imports retain their custody; a native reorder blocks rollback and repeat", async () => {
  const f = await fixture("RLI");
  const csv =
    [
      [
        "ID",
        "Team",
        "Title",
        "Description",
        "Status",
        "Estimate",
        "Priority",
        "Project",
        "Assignee",
        "Labels",
        "Cycle Name",
        "Created",
        "Updated",
        "Due Date",
        "Parent issue",
        "Archived",
      ],
      ...["Last Linear issue", "First Linear issue", "Middle Linear issue"].map(
        (title, index) => [
          "ENG-" + (index + 1),
          f.team.name,
          title,
          "",
          "Backlog",
          "",
          "0",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ],
      ),
    ]
      .map((row) => row.join(","))
      .join("\n") + "\n";
  const api = {
    issues: [
      { identifier: "ENG-1", sortOrder: 900.5 },
      { identifier: "ENG-2", sortOrder: -20.25 },
      { identifier: "ENG-3", sortOrder: 0 },
    ],
  };
  const input: ImportInput = {
    format: "linear-api-json",
    source: "ordered-linear",
    name: "linear.csv",
    base64: encode(csv),
    mapping: {},
    api: { name: "linear.json", base64: encode(JSON.stringify(api)) },
  };
  const run = await f.publish(input);
  const rows = await f.list();
  expect(rows.map((i) => i.title)).toEqual([
    "First Linear issue",
    "Middle Linear issue",
    "Last Linear issue",
  ]);
  expect((await f.preview(input)).measured.reused).toBe(3);
  const order = (await (
    await f.call("/issues/order?teamId=" + f.team.id)
  ).json()) as { version: number };
  expect(
    (
      await f.call("/issues/order", "POST", {
        teamId: f.team.id,
        identifier: rows[2].identifier,
        action: "top",
        expectedVersion: order.version,
      })
    ).status,
  ).toBe(200);
  expect(
    (await f.preview(input)).errors.some(
      (e) => e.code === "native_edit_conflict",
    ),
  ).toBe(true);
  const rollback = await f.call(
    "/data/import/runs/" + run.id + "/rollback",
    "POST",
    { confirmed: true },
  );
  expect(rollback.status).toBe(409);
  // No rank key is manufactured for older API files or ordinary mapped imports.
  const legacy = f.input(
    [f.row("legacy-orderless", { team: f.team.id, status: f.status.id })],
    "legacy-orderless",
  );
  await f.publish(legacy);
  expect((await f.preview(legacy)).errors).toEqual([]);
  expect((await f.preview(legacy)).measured.reused).toBe(1);
  const malformed = {
    ...input,
    source: "bad-linear-rank",
    api: {
      name: "linear.json",
      base64: encode(
        JSON.stringify({
          issues: [{ identifier: "ENG-1", sortOrder: "first" }],
        }),
      ),
    },
  };
  expect(
    (await f.preview(malformed)).errors.some(
      (e) => e.field === "api sortOrder",
    ),
  ).toBe(true);
});
