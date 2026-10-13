import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { setupImport } from "./data-import-fixture";
it("[ISSUE-010 DATA-002 DATA-004] native deletion erases real retained import custody, withdraws affected originals and fences replay without changing unrelated originals", async () => {
  const f = await setupImport(),
    value = f.input([
      f.row("erase", {
        title: "Private erasure target",
        description: "Private erasure body",
      }),
      f.row("keep", { title: "Surviving imported issue" }),
    ]),
    job = await f.publish(value);
  const unrelated = f.input([f.row("unrelated")], "unrelated-erasure-control"),
    other = await f.publish(unrelated);
  const removed = await env.DB.prepare(
    "SELECT identifier,version,id FROM issues WHERE title='Private erasure target'",
  ).first<{ identifier: string; version: number; id: string }>();
  const preserved = await env.DB.prepare(
    "SELECT * FROM issues WHERE title='Surviving imported issue'",
  ).first();
  const originalsBefore = await (
    await f.call("/data/import/runs/" + other.id + "/originals")
  ).json();
  const tables = (
    await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ik_%' ORDER BY name",
    ).all<{ name: string }>()
  ).results;
  async function custody() {
    return Object.fromEntries(
      await Promise.all(
        tables.map(async ({ name }) => [
          name,
          (
            await env.DB.prepare(
              'SELECT * FROM "' + name + '" ORDER BY rowid',
            ).all()
          ).results,
        ]),
      ),
    );
  }
  const privateBefore = await custody();
  const controlRows = (rows: typeof privateBefore) =>
    Object.fromEntries(
      Object.entries(rows).map(([table, values]) => [
        table,
        values.filter(
          (row) =>
            row.job_id === other.id ||
            row.owner_job_id === other.id ||
            (table === "ik_jobs" && row.id === other.id),
        ),
      ]),
    );
  const unrelatedBefore = controlRows(privateBefore);
  const originalBefore = await (
    await f.call("/data/import/runs/" + job.id + "/originals")
  ).json();
  await env.DB.exec(
    "CREATE TRIGGER refuse_import_deletion BEFORE DELETE ON issues BEGIN SELECT RAISE(ABORT,'late erasure failure'); END;",
  );
  try {
    expect(
      (
        await f.call("/issues/" + removed!.identifier, "DELETE", {
          expectedVersion: removed!.version,
          confirmed: true,
        })
      ).status,
    ).toBe(500);
    expect(await custody()).toEqual(privateBefore);
    expect(
      await (await f.call("/data/import/runs/" + job.id + "/originals")).json(),
    ).toEqual(originalBefore);
    expect(
      await env.DB.prepare("SELECT 1 FROM issues WHERE id=?")
        .bind(removed!.id)
        .first(),
    ).not.toBeNull();
  } finally {
    await env.DB.exec("DROP TRIGGER refuse_import_deletion");
  }
  const response = await f.call("/issues/" + removed!.identifier, "DELETE", {
    expectedVersion: removed!.version,
    confirmed: true,
  });
  expect(response.status, await response.clone().text()).toBe(200);
  const custodyAfter = await custody();
  expect(controlRows(custodyAfter)).toEqual(unrelatedBefore);
  console.info(
    "issue-deletion-import-counts",
    JSON.stringify(
      tables.map(({ name }) => ({
        table: name,
        before: privateBefore[name].length,
        after: custodyAfter[name].length,
        unrelated: unrelatedBefore[name].length,
      })),
    ),
  );
  expect(
    await env.DB.prepare("SELECT 1 FROM issues WHERE id=?")
      .bind(removed!.id)
      .first(),
  ).toBeNull();
  expect(
    await env.DB.prepare(
      "SELECT * FROM issues WHERE title='Surviving imported issue'",
    ).first(),
  ).toEqual(preserved);
  const originals = (await (
    await f.call("/data/import/runs/" + job.id + "/originals")
  ).json()) as any[];
  expect(originals.every((row) => row.original.status === "unavailable")).toBe(
    true,
  );
  expect(
    await (await f.call("/data/import/runs/" + other.id + "/originals")).json(),
  ).toEqual(originalsBefore);
  expect(
    (await f.call("/data/import/runs/" + job.id + "/resume", "POST", {}))
      .status,
  ).toBe(200);
  for (const { name } of tables) {
    const rows = (await env.DB.prepare('SELECT * FROM "' + name + '"').all())
      .results;
    const stored = rows
      .flatMap((row) =>
        Object.values(row).flatMap((value) =>
          typeof value === "string"
            ? [value]
            : Array.isArray(value)
              ? [new TextDecoder().decode(new Uint8Array(value))]
              : [],
        ),
      )
      .join("\n");
    expect(stored, name + " retained erasure target").not.toContain(
      "Private erasure target",
    );
    expect(stored, name + " retained erasure body").not.toContain(
      "Private erasure body",
    );
    expect(stored, name + " retained original").not.toContain(value.base64);
  }
  const review = await f.preview(value);
  expect(review.ready).toBe(false);
  const rollback = await f.call(
    "/data/import/runs/" + job.id + "/rollback",
    "POST",
    { confirmed: true },
  );
  expect(rollback.status).toBe(200);
  expect(
    await env.DB.prepare("SELECT 1 FROM issues WHERE id=?")
      .bind(removed!.id)
      .first(),
  ).toBeNull();
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM ik_d1_erased_targets",
    ).first<number>("n"),
  ).toBeGreaterThan(0);
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
}, 180000);
