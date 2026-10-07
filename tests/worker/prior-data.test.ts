import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import assert from 'node:assert/strict'
import { inject, it } from 'vitest'
import { ensureSampleData } from '../../src/core/features/sample-data/service'
import { loadWorkspaceSnapshot } from '../../src/core/features/streams/repository'
import { vectorSampleIds as ids } from '../../sample-data/vector'
import { createServerApp } from '../../src/core/app/server'
import { testCookie } from './native-fixture'

it('[BASE-OPS-002] expands a populated original Vector database without changing prior evidence, decisions, identifiers, sequences or session history', async () => {
  const migrations = inject('migrations')
  await applyD1Migrations(env.DB, migrations.slice(0, 2))
  await ensureSampleData(env.DB, new Date('2026-08-31T12:00:00.000Z'))
  const before = await loadWorkspaceSnapshot(env.DB)
  const sessionsBefore = await env.DB.prepare('SELECT * FROM operator_sessions ORDER BY id').all()
  const sequencesBefore = await env.DB.prepare('SELECT * FROM team_issue_sequences ORDER BY team_id').all()
  await applyD1Migrations(env.DB, migrations.slice(2, 4))
  const legacyFileId = '01J00000000000000000000778'
  const key = 'prior-data/retained-evidence.txt'
  await env.FILES.put(key, 'Existing file bytes')
  await env.DB.prepare('INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(legacyFileId, ids.flw842, ids.sarah, 'retained-evidence.txt', 'text/plain', 19, key, '2026-09-30T00:00:00.000Z', '2026-09-30T00:00:00.000Z').run()
  await applyD1Migrations(env.DB, migrations.slice(4))
  assert.deepEqual(await loadWorkspaceSnapshot(env.DB), before)
  assert.deepEqual((await env.DB.prepare('SELECT * FROM operator_sessions ORDER BY id').all()).results, sessionsBefore.results)
  assert.deepEqual((await env.DB.prepare('SELECT * FROM team_issue_sequences ORDER BY team_id').all()).results, sequencesBefore.results)
  assert.deepEqual(await env.DB.prepare('SELECT state,name FROM issue_files WHERE id=?').bind(legacyFileId).first(), { state: 'ready', name: 'retained-evidence.txt' })
  const app = createServerApp()
  const response = await app.request('https://vector.test/api/issues/FLW-842/files/' + legacyFileId, { headers: { cookie: await testCookie(env.DB, ids.sarah) } }, { ...env, APP_ORIGIN: 'https://vector.test' })
  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'Existing file bytes')
  const detail = await app.request('https://vector.test/api/issues/FLW-842', { headers: { cookie: await testCookie(env.DB, ids.sarah) } }, { ...env, APP_ORIGIN: 'https://vector.test' })
  assert.equal(detail.status, 200)
  assert.deepEqual((await detail.json() as any).evidence[0].assertions.recommendation, { source: 'policy', assigneeOperatorId: ids.maya, priority: 'high', statusCategory: 'started', team: 'Reliability', onCall: true })
})
