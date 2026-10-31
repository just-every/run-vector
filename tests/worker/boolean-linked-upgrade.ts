import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { expect, inject } from 'vitest';
import { insertHistoricalSample } from './historical-sample-fixture';
import { validateArchiveInventory } from '../../src/core/features/data/archive-inventory.mjs';

/** A populated installation gains revision fences without rewriting domain data. */
export async function booleanLinkedUpgrade() {
  const db = env.ARCHIVE_TARGET_DB, migrations = inject('migrations');
  const boundary = migrations.findIndex(row => row.name === '0121_filter_link_revisions.sql');
  await applyD1Migrations(db, migrations.slice(0, boundary));
  await insertHistoricalSample(db, new Date('2026-10-01T00:00:00Z'));
  const issues = (await db.prepare('SELECT i.id,t.workspace_id FROM issues i JOIN teams t ON t.id=i.team_id ORDER BY i.id LIMIT 2').all<{ id: string; workspace_id: string }>()).results;
  expect(issues).toHaveLength(2);
  await db.prepare('INSERT INTO issue_relations(first_issue_id,second_issue_id,created_at) VALUES(?,?,?)').bind(issues[0].id, issues[1].id, '2026-10-01T00:00:00.000Z').run();
  await db.prepare("INSERT INTO releases(id,workspace_id,name,status,created_at,updated_at) VALUES(?,?,?,'planned',?,?)").bind('synthetic-vector-133-release', issues[0].workspace_id, 'synthetic-vector-133', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z').run();
  await db.prepare('INSERT INTO release_issues(release_id,issue_id) VALUES(?,?)').bind('synthetic-vector-133-release', issues[0].id).run();
  const tables = ['issues', 'issue_relations', 'releases', 'release_issues', 'release_projects', 'vector_github_pull_requests', 'vector_github_issue_links', 'issue_followers'];
  const records = async () => Object.fromEntries(await Promise.all(tables.map(async table => [table, (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results])));
  const before = await records();
  const ledger = (await db.prepare('SELECT * FROM d1_migrations ORDER BY id').all()).results;
  await applyD1Migrations(db, migrations.slice(boundary));
  expect(await records()).toEqual(before);
  expect((await db.prepare('SELECT * FROM d1_migrations ORDER BY id').all()).results.slice(0, ledger.length)).toEqual(ledger);
  await validateArchiveInventory(db);
  const revision = await db.prepare('SELECT revision FROM issue_list_revision WHERE id=1').first<number>('revision');
  await db.prepare('DELETE FROM release_issues WHERE release_id=?').bind('synthetic-vector-133-release').run();
  expect(await db.prepare('SELECT revision FROM issue_list_revision WHERE id=1').first<number>('revision')).toBeGreaterThan(revision!);
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  console.log('PROBE SEARCH-004 upgrade: populated prior migration -> retained issue and linked facts, unchanged prior ledger and archive inventory, new release change advances pagination revision');
}
