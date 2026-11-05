import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { expect, inject } from 'vitest'
import { insertHistoricalSample } from './historical-sample-fixture'

export async function requestFormsUpgrade() {
  const db = env.ARCHIVE_TARGET_DB, migrations = inject('migrations'), boundary = migrations.findIndex(m => m.name === '0126_request_forms.sql')
  expect(boundary).toBeGreaterThan(0)
  await applyD1Migrations(db, migrations.slice(0, boundary))
  await insertHistoricalSample(db, new Date('2026-10-01T00:00:00Z'))
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' ORDER BY name").all<{ name: string }>()).results
  const before = await Promise.all(tables.map(async ({ name }) => {
    const order = (await db.prepare('PRAGMA table_info("' + name + '")').all<{name:string}>()).results.map(c => '"' + c.name + '"').join(',')
    return {name,order,rows:(await db.prepare('SELECT * FROM "' + name + '" ORDER BY '+order).all()).results}
  }))
  await applyD1Migrations(db, migrations.slice(boundary))
  for (const table of before) expect((await db.prepare('SELECT * FROM "' + table.name + '" ORDER BY ' + table.order).all()).results, table.name).toEqual(table.rows)
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
}
