import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject, it } from "vitest";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { listIssues } from "../../src/core/features/issues/list";
import { issueListQuerySchema } from "../../src/core/features/issues/list-schema";
import { getView } from "../../src/core/features/views/service";
import { getPreference } from "../../src/core/features/views/preferences";
it("[VIEW-001 VIEW-002 VIEW-003 BASE-OPS-002 BASE-DATA-003] populated 0016 to 0017 preserves every existing column, saved query and preference and supports retained-schema rollback", async () => {
  const migrations = inject("migrations"),
    next = migrations.find((m) => m.name === "0017_browsing_views.sql")!;
  expect(migrations.indexOf(next)).toBe(16);
  await applyD1Migrations(env.DB, migrations.slice(0, 2));
  await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00Z"));
  await applyD1Migrations(env.DB, migrations.slice(2, 16));
  await env.DB.prepare(
    "UPDATE list_preferences SET filters_json=?,sort='priority',grouping='none' WHERE id=?",
  )
    .bind(
      JSON.stringify({
        teamId: ids.flow,
        priority: "high",
        assigneeId: "unassigned",
      }),
      ids.preference,
    )
    .run();
  const tables = (
    await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name",
    ).all<{ name: string }>()
  ).results;
  const before = await Promise.all(
    tables.map(async ({ name }) => {
      const columns = (
        await env.DB.prepare(`PRAGMA table_info("${name}")`).all<{
          name: string;
        }>()
      ).results
        .map((r) => `"${r.name}"`)
        .join(",");
      return {
        name,
        columns,
        rows: (
          await env.DB.prepare(
            `SELECT ${columns} FROM "${name}" ORDER BY ${columns}`,
          ).all()
        ).results,
      };
    }),
  );
  expect(
    before.find((t) => t.name === "saved_views")!.rows.length,
  ).toBeGreaterThan(0);
  expect(
    before.find((t) => t.name === "list_preferences")!.rows.length,
  ).toBeGreaterThan(0);
  await applyD1Migrations(env.DB, [next]);
  await applyD1Migrations(env.DB, [next]);
  // Finish the historical preservation and rollback proof at exactly 0017.
  expect(
    (await env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id").all())
      .results,
  ).toEqual(migrations.slice(0, 17).map(({ name }) => ({ name })));
  for (const table of before)
    expect(
      (
        await env.DB.prepare(
          `SELECT ${table.columns} FROM "${table.name}" ORDER BY ${table.columns}`,
        ).all()
      ).results,
      table.name,
    ).toEqual(table.rows);
  const view = await getView(env.DB, ids.sarah, ids.savedView);
  expect(view.layout).toBe("list");
  expect(view.query.label).toBe(ids.reliabilityLabel);
  expect(view.query.sort).toBe("priority");
  expect(view.query.grouping).toBe("project");
  const preference = await getPreference(env.DB, ids.sarah, "current");
  expect(preference.filters).toEqual({
    teamId: ids.flow,
    priority: "high",
    assigneeId: "unassigned",
  });
  expect(
    (
      await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%browse%' OR name='saved_views_workspace_visibility'",
      ).all()
    ).results.length,
  ).toBe(5);
  await expect(
    env.DB.prepare("UPDATE saved_views SET layout='invalid' WHERE id=?")
      .bind(ids.savedView)
      .run(),
  ).rejects.toThrow(/CHECK/);
  // Old application SQL still works while the additive layout column remains.
  await env.DB.prepare("UPDATE saved_views SET name=name WHERE id=?")
    .bind(ids.savedView)
    .run();
  expect(await getView(env.DB, ids.sarah, ids.savedView)).toEqual(view);
  // The pre-0018 search reader still joins source rowids at this boundary.
  expect(
    await env.DB.prepare(
      "SELECT v.id FROM saved_views v JOIN search_views s ON s.rowid=v.rowid WHERE v.id=? AND s.name=v.name",
    )
      .bind(ids.savedView)
      .first("id"),
  ).toBe(ids.savedView);
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);

  // Current readers require the later stable-ID and browsing-revision schema.
  // Later rollback requires compatible source per docs/BROWSING-RECOVERY.md.
  await applyD1Migrations(env.DB, migrations.slice(17));
  expect(
    (await env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id").all())
      .results,
  ).toEqual(migrations.map(({ name }) => ({ name })));
  const listing = await listIssues(
    env.DB,
    ids.sarah,
    issueListQuerySchema.parse({}),
  );
  expect(listing.issues.length).toBeGreaterThan(0);
  expect(listing.revision.length).toBeGreaterThan(0);
  const visibleStatuses = new Set(
    before
      .find((table) => table.name === "workflow_statuses")!
      .rows.filter((row) => row.category !== "completed")
      .map((row) => row.id),
  );
  const retainedIssues = before
    .find((table) => table.name === "issues")!
    .rows.filter((row) => visibleStatuses.has(row.status_id))
    .map(({ id, identifier, title, version }) => ({
      id,
      identifier,
      title,
      version,
    }));
  expect(listing.total).toBe(retainedIssues.length);
  expect(
    listing.issues
      .map(({ id, identifier, title, version }) => ({
        id,
        identifier,
        title,
        version,
      }))
      .sort((a, b) => a.identifier.localeCompare(b.identifier)),
  ).toEqual(
    retainedIssues.sort((a, b) =>
      String(a.identifier).localeCompare(String(b.identifier)),
    ),
  );
  expect(await getView(env.DB, ids.sarah, ids.savedView)).toEqual(view);
  expect(await getPreference(env.DB, ids.sarah, "current")).toEqual(preference);
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
});
